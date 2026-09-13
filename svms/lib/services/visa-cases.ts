import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { visaScope } from "@/lib/services/employee-dashboard";
import { titleCase } from "@/lib/utils";

/**
 * Employee Visa Management service — server-side data layer for
 * /employee/visa (list) and /employee/visa/[id] (detail).
 *
 * IDOR closure: every query embeds the caller's visa scope filter.
 * EMPLOYEE sees visa applications on students assigned to them. ADMIN sees all.
 * Foreign visa applications return 404 (never 403).
 */

// ─────────────────────────────────────────────
// Visa stages + transition rules
// ─────────────────────────────────────────────

export const VISA_STAGES = [
  "PREPARATION",
  "SUBMITTED",
  "BIOMETRICS",
  "INTERVIEW",
  "PROCESSING",
  "APPROVED",
  "REFUSED",
  "WITHDRAWN",
  "COMPLETED",
] as const;

export type VisaStage = (typeof VISA_STAGES)[number];

/** Forward-only successor map. Terminal stages have no successor. */
const NEXT_VISA_STAGE: Record<string, string | undefined> = Object.fromEntries(
  VISA_STAGES.map((s, i) => [s, VISA_STAGES[i + 1]]),
);

/** Explicitly allowed backward/rework transitions. */
const ALLOWED_BACKWARD: Record<string, string[]> = {
  BIOMETRICS: ["PREPARATION"],
  INTERVIEW: ["PREPARATION"],
  PROCESSING: ["PREPARATION"],
  REFUSED: ["PREPARATION"],
  WITHDRAWN: ["PREPARATION"],
};

/** Terminal stages — cannot transition out of these. */
const TERMINAL_STAGES = new Set(["APPROVED", "COMPLETED"]);

export type VisaTransitionBlock = { code: string; reason: string };

export function validateVisaTransitionShape(fromStage: string, toStage: string): VisaTransitionBlock | null {
  if (!VISA_STAGES.includes(fromStage as VisaStage)) {
    return { code: "INVALID_FROM", reason: `Unknown source stage: ${fromStage}` };
  }
  if (!VISA_STAGES.includes(toStage as VisaStage)) {
    return { code: "INVALID_TO", reason: `Unknown target stage: ${toStage}` };
  }
  if (fromStage === toStage) return null;

  // Terminal stages cannot transition out
  if (TERMINAL_STAGES.has(fromStage)) {
    return { code: "TERMINAL", reason: `Cannot transition from terminal stage ${fromStage}` };
  }

  const fromIdx = VISA_STAGES.indexOf(fromStage as VisaStage);
  const toIdx = VISA_STAGES.indexOf(toStage as VisaStage);

  if (toIdx === fromIdx + 1) return null; // forward successor

  if (toIdx < fromIdx) {
    const allowed = ALLOWED_BACKWARD[fromStage] ?? [];
    if (allowed.includes(toStage)) return null;
    return { code: "BACKWARD_BLOCKED", reason: `Cannot move backward from ${fromStage} to ${toStage}` };
  }

  return { code: "SKIP_BLOCKED", reason: `Cannot skip from ${fromStage} to ${toStage}. Move to ${NEXT_VISA_STAGE[fromStage]} first.` };
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type VisaListFilters = {
  search?: string;
  countryId?: string;
  stage?: string;
  submittedFrom?: string;
  submittedTo?: string;
  decision?: string; // APPROVED | REFUSED | pending
  assignedEmployeeId?: string;
};

export type VisaRow = {
  id: string;
  visaType: string | null;
  stage: string;
  submittedAt: Date | null;
  biometricsAt: Date | null;
  interviewAt: Date | null;
  decisionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  application: { id: string; applicationNumber: string };
  country: { id: string; name: string; flag: string | null } | null;
  assignedEmployee: { id: string; name: string } | null;
  nextAction: string | null;
};

export type VisaListResult = {
  rows: VisaRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type VisaDetail = {
  id: string;
  visaType: string | null;
  stage: string;
  submittedAt: Date | null;
  biometricsAt: Date | null;
  interviewAt: Date | null;
  decisionAt: Date | null;
  decisionReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  application: {
    id: string; applicationNumber: string; stageKey: string; status: string;
    student: { id: string; firstName: string; lastName: string; studentId: string; email: string };
    country: { id: string; name: string; flag: string | null };
    university: { name: string } | null;
  };
  assignedEmployee: { id: string; name: string } | null;
  documents: {
    id: string; name: string; status: string; documentType: string | null;
    uploadedAt: Date | null; reviewedAt: Date | null;
  }[];
  appointments: {
    id: string; title: string; type: string; scheduledAt: Date; status: string;
  }[];
  stageHistory: {
    id: string; fromStage: string | null; toStage: string; note: string | null;
    changedById: string; changedByName: string; createdAt: Date;
  }[];
  requirements: {
    id: string; name: string; description: string | null; required: boolean;
  }[];
};

// ─────────────────────────────────────────────
// List
// ─────────────────────────────────────────────

export async function listVisaApplications(
  scope: EmployeeScope,
  params: { filters?: VisaListFilters; page?: number; pageSize?: number } = {},
): Promise<VisaListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};
  const owner = visaScope(scope);

  const fieldFilters: Record<string, unknown> = {};
  if (filters.stage) fieldFilters.stage = filters.stage;
  if (filters.assignedEmployeeId) fieldFilters.assignedEmployeeId = filters.assignedEmployeeId;

  // Decision filter
  if (filters.decision === "APPROVED") fieldFilters.stage = "APPROVED";
  else if (filters.decision === "REFUSED") fieldFilters.stage = "REFUSED";
  else if (filters.decision === "pending") {
    fieldFilters.stage = { notIn: ["APPROVED", "REFUSED", "WITHDRAWN", "COMPLETED"] };
  }

  // Country filter
  if (filters.countryId) fieldFilters.application = { countryId: filters.countryId };

  // Submitted date range
  const submittedRange: Record<string, unknown> = {};
  if (filters.submittedFrom) {
    const d = new Date(filters.submittedFrom);
    if (!isNaN(d.getTime())) submittedRange.gte = d;
  }
  if (filters.submittedTo) {
    const d = new Date(filters.submittedTo);
    if (!isNaN(d.getTime())) submittedRange.lte = d;
  }
  if (Object.keys(submittedRange).length > 0) fieldFilters.submittedAt = submittedRange;

  // Search
  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { visaType: { contains: search, mode: "insensitive" as const } },
          { application: { applicationNumber: { contains: search, mode: "insensitive" as const } } },
          { application: { student: { firstName: { contains: search, mode: "insensitive" as const } } } },
          { application: { student: { lastName: { contains: search, mode: "insensitive" as const } } } },
        ],
      }
    : {};

  const where = { ...owner, ...searchFilter, ...fieldFilters };

  const [rows, total] = await Promise.all([
    prisma.visaApplication.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, visaType: true, stage: true, submittedAt: true,
        biometricsAt: true, interviewAt: true, decisionAt: true,
        createdAt: true, updatedAt: true,
        application: {
          select: {
            id: true, applicationNumber: true,
            student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
            country: { select: { id: true, name: true, flag: true } },
          },
        },
        assignedEmployee: { select: { id: true, user: { select: { name: true } } } },
      },
    }),
    prisma.visaApplication.count({ where }),
  ]);

  const mapped: VisaRow[] = rows.map((v) => {
    let nextAction: string | null = null;
    if (v.stage === "PREPARATION") nextAction = "Submit visa application";
    else if (v.stage === "SUBMITTED" && v.biometricsAt) nextAction = "Biometrics appointment";
    else if (v.stage === "BIOMETRICS" && v.interviewAt) nextAction = "Attend interview";
    else if (v.stage === "INTERVIEW") nextAction = "Await processing";
    else if (v.stage === "PROCESSING") nextAction = "Await decision";

    return {
      id: v.id, visaType: v.visaType, stage: v.stage,
      submittedAt: v.submittedAt, biometricsAt: v.biometricsAt,
      interviewAt: v.interviewAt, decisionAt: v.decisionAt,
      createdAt: v.createdAt, updatedAt: v.updatedAt,
      student: v.application.student,
      application: { id: v.application.id, applicationNumber: v.application.applicationNumber },
      country: v.application.country,
      assignedEmployee: v.assignedEmployee ? { id: v.assignedEmployee.id, name: v.assignedEmployee.user.name } : null,
      nextAction,
    };
  });

  return { rows: mapped, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ─────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────

export async function getVisaById(scope: EmployeeScope, id: string): Promise<VisaDetail | null> {
  const owner = visaScope(scope);
  const visa = await prisma.visaApplication.findFirst({
    where: { id, ...owner },
    select: {
      id: true, visaType: true, stage: true, submittedAt: true,
      biometricsAt: true, interviewAt: true, decisionAt: true, decisionReason: true,
      notes: true, createdAt: true, updatedAt: true,
      application: {
        select: {
          id: true, applicationNumber: true, stageKey: true, status: true,
          student: { select: { id: true, firstName: true, lastName: true, studentId: true, email: true } },
          country: { select: { id: true, name: true, flag: true } },
          university: { select: { name: true } },
          documents: {
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, status: true, documentType: true, uploadedAt: true, reviewedAt: true },
          },
        },
      },
      assignedEmployee: { select: { id: true, user: { select: { name: true } } } },
      stageHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, fromStage: true, toStage: true, note: true, changedById: true, createdAt: true },
      },
    },
  });

  if (!visa) return null;

  // Resolve actor names for stage history
  const actorIds = Array.from(new Set(visa.stageHistory.map((h) => h.changedById)));
  const actors = actorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorMap = new Map(actors.map((u) => [u.id, u.name]));

  // Resolve appointments for the student
  const appointments = await prisma.appointment.findMany({
    where: { studentId: visa.application.student.id, status: "SCHEDULED" },
    orderBy: { scheduledAt: "asc" },
    take: 5,
    select: { id: true, title: true, type: true, scheduledAt: true, status: true },
  });

  // Resolve visa requirements for the destination country
  const countryId = visa.application.country?.id;
  const requirements = countryId
    ? await prisma.visaRequirement.findMany({
        where: { countryId, status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, description: true, required: true },
      })
    : [];

  return {
    id: visa.id,
    visaType: visa.visaType,
    stage: visa.stage,
    submittedAt: visa.submittedAt,
    biometricsAt: visa.biometricsAt,
    interviewAt: visa.interviewAt,
    decisionAt: visa.decisionAt,
    decisionReason: visa.decisionReason,
    notes: visa.notes,
    createdAt: visa.createdAt,
    updatedAt: visa.updatedAt,
    application: {
      id: visa.application.id,
      applicationNumber: visa.application.applicationNumber,
      stageKey: visa.application.stageKey,
      status: visa.application.status,
      student: visa.application.student,
      country: visa.application.country,
      university: visa.application.university,
    },
    assignedEmployee: visa.assignedEmployee ? { id: visa.assignedEmployee.id, name: visa.assignedEmployee.user.name } : null,
    documents: visa.application.documents,
    appointments,
    stageHistory: visa.stageHistory.map((h) => ({
      ...h,
      changedByName: actorMap.get(h.changedById) ?? "Unknown",
    })),
    requirements,
  };
}

export async function requireVisa(scope: EmployeeScope, id: string): Promise<VisaDetail> {
  const v = await getVisaById(scope, id);
  if (!v) throw new HttpError(404, "NOT_FOUND", "Visa application not found");
  return v;
}

// ─────────────────────────────────────────────
// Status change — validated + history + notifications + audit
// ─────────────────────────────────────────────

export async function changeVisaStage(
  scope: EmployeeScope,
  id: string,
  toStage: string,
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
  note?: string,
): Promise<{ fromStage: string; toStage: string; historyId: string }> {
  if (!VISA_STAGES.includes(toStage as VisaStage)) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid visa stage: ${toStage}`);
  }

  const owner = visaScope(scope);
  const visa = await prisma.visaApplication.findFirst({
    where: { id, ...owner },
    select: { id: true, stage: true, applicationId: true },
  });
  if (!visa) throw new HttpError(404, "NOT_FOUND", "Visa application not found");

  if (visa.stage === toStage) {
    return { fromStage: visa.stage, toStage, historyId: "" };
  }

  const block = validateVisaTransitionShape(visa.stage, toStage);
  if (block) {
    throw new HttpError(422, "VALIDATION_ERROR", `Transition blocked: ${block.reason} [code: ${block.code}]`);
  }

  // Set date fields based on the new stage
  const now = new Date();
  const updateData: Record<string, unknown> = { stage: toStage, updatedAt: now };
  if (toStage === "SUBMITTED") updateData.submittedAt = now;
  if (toStage === "BIOMETRICS" && !visa.stage) updateData.biometricsAt = now;
  if (toStage === "INTERVIEW" && !visa.stage) updateData.interviewAt = now;
  if (toStage === "APPROVED" || toStage === "REFUSED") {
    updateData.decisionAt = now;
    if (note) updateData.decisionReason = note;
  }
  if (note && toStage !== "APPROVED" && toStage !== "REFUSED") {
    updateData.notes = note;
  }

  const [, history] = await prisma.$transaction([
    prisma.visaApplication.update({ where: { id }, data: updateData }),
    prisma.visaStageHistory.create({
      data: {
        visaApplicationId: id,
        fromStage: visa.stage,
        toStage,
        changedById: actor.id,
        note: note ?? null,
      },
    }),
  ]);

  // Notification
  try {
    const app = await prisma.application.findFirst({
      where: { id: visa.applicationId },
      select: { student: { select: { userId: true, firstName: true, lastName: true } } },
    });
    if (app) {
      await prisma.notification.create({
        data: {
          userId: app.student.userId,
          type: "VISA_STAGE_CHANGED",
          title: `Visa status: ${titleCase(toStage)}`,
          message: `Your visa application status has been updated to ${toStage.toLowerCase()}.`,
          link: "/employee/visa",
        },
      });
    }
  } catch (err) {
    console.error("[visa-stage-change] notification failed", err);
  }

  // Audit log for decision stages
  if (toStage === "APPROVED" || toStage === "REFUSED" || toStage === "WITHDRAWN") {
    try {
      await prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: "visa.stage_changed",
          entity: "VisaApplication",
          entityId: id,
          oldValue: { stage: visa.stage },
          newValue: { stage: toStage, note: note ?? null },
          ipAddress: actor.ipAddress ?? undefined,
          userAgent: actor.userAgent ?? undefined,
        },
      });
    } catch (err) {
      console.error("[visa-stage-change] audit log failed", err);
    }
  }

  return { fromStage: visa.stage, toStage, historyId: history.id };
}

// ─────────────────────────────────────────────
// Transition preview
// ─────────────────────────────────────────────

export type VisaTransitionPreview = {
  toStage: string;
  allowed: boolean;
  block: VisaTransitionBlock | null;
};

export async function getVisaTransitionPreviews(
  scope: EmployeeScope,
  id: string,
): Promise<{ currentStage: string; previews: VisaTransitionPreview[] }> {
  const owner = visaScope(scope);
  const visa = await prisma.visaApplication.findFirst({
    where: { id, ...owner },
    select: { id: true, stage: true },
  });
  if (!visa) throw new HttpError(404, "NOT_FOUND", "Visa application not found");

  const previews: VisaTransitionPreview[] = VISA_STAGES
    .filter((s) => s !== visa.stage)
    .map((toStage) => {
      const block = validateVisaTransitionShape(visa.stage, toStage);
      return { toStage, allowed: block === null, block };
    });

  return { currentStage: visa.stage, previews };
}
