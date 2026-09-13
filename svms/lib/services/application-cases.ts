import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";

/**
 * Employee Application Management service — server-side data layer for
 * /employee/applications (list + kanban) and /employee/applications/[id].
 *
 * Reuses the dashboard's `EmployeeScope` type + `APPLICATION_STAGES` constant
 * so case ownership + stage definitions stay consistent across modules.
 *
 * IDOR closure: every query embeds the caller's scope filter. For EMPLOYEE,
 * the filter is `{ student: { assignedEmployee: { userId: <session> } } }`
 * OR `{ assignedEmployee: { userId: <session> } }` — so employees see
 * applications on their assigned students OR applications directly assigned
 * to them. ADMIN sees all. Foreign applications return 404 (never 403).
 */

// ─────────────────────────────────────────────
// Scope — merged student-assignment + direct-application-assignment
// ─────────────────────────────────────────────

export function applicationCaseScope(scope: EmployeeScope): Record<string, unknown> {
  if (scope.isAdmin) return {};
  // Employee sees applications where:
  //   (a) the student is assigned to them, OR
  //   (b) the application is directly assigned to them
  return {
    OR: [
      { student: { assignedEmployeeId: scope.employeeId } },
      { assignedEmployeeId: scope.employeeId },
    ],
  };
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ApplicationSortKey =
  | "applicationNumber"
  | "createdAt"
  | "updatedAt"
  | "deadline"
  | "priority"
  | "stageKey";

export type ApplicationListFilters = {
  search?: string;
  stage?: string;
  status?: string;
  priority?: string;
  countryId?: string;
  universityId?: string;
  courseId?: string;
  intakeId?: string;
  assignedEmployeeId?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  archived?: boolean;
};

export type ApplicationRow = {
  id: string;
  applicationNumber: string;
  stageKey: string;
  status: string;
  priority: string;
  deadline: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  country: { name: string } | null;
  university: { name: string } | null;
  course: { name: string } | null;
  intake: { name: string; deadline: Date | null } | null;
  assignedEmployee: { id: string; user: { name: string } } | null;
  nextDeadline: Date | null;
  nextAction: string | null;
};

export type ApplicationListResult = {
  rows: ApplicationRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ─────────────────────────────────────────────
// List — paginated with filters + sorting
// ─────────────────────────────────────────────

const SORT_ALLOWLIST: Record<ApplicationSortKey, Record<string, "asc" | "desc">> = {
  applicationNumber: { applicationNumber: "asc" },
  createdAt: { createdAt: "desc" },
  updatedAt: { updatedAt: "desc" },
  deadline: { deadline: "asc" },
  priority: { priority: "desc" },
  stageKey: { stageKey: "asc" },
};

const PRIORITY_ORDER: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export async function listApplications(
  scope: EmployeeScope,
  params: {
    filters?: ApplicationListFilters;
    page?: number;
    pageSize?: number;
    sortBy?: ApplicationSortKey;
    sortOrder?: "asc" | "desc";
  } = {},
): Promise<ApplicationListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};
  const sortBy = params.sortBy ?? "updatedAt";
  const sortOrder = params.sortOrder ?? "desc";

  const owner = applicationCaseScope(scope);

  // Archived filter: default = exclude archived. archived=true → only archived.
  const archivedFilter = filters.archived
    ? { archivedAt: { not: null } }
    : { archivedAt: null };

  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { applicationNumber: { contains: search, mode: "insensitive" as const } },
          { student: { firstName: { contains: search, mode: "insensitive" as const } } },
          { student: { lastName: { contains: search, mode: "insensitive" as const } } },
          { student: { studentId: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const fieldFilters: Record<string, unknown> = {};
  if (filters.stage) fieldFilters.stageKey = filters.stage;
  if (filters.status) fieldFilters.status = filters.status;
  if (filters.priority) fieldFilters.priority = filters.priority;
  if (filters.countryId) fieldFilters.countryId = filters.countryId;
  if (filters.universityId) fieldFilters.universityId = filters.universityId;
  if (filters.courseId) fieldFilters.courseId = filters.courseId;
  if (filters.intakeId) fieldFilters.intakeId = filters.intakeId;
  if (filters.assignedEmployeeId) fieldFilters.assignedEmployeeId = filters.assignedEmployeeId;

  // Deadline range
  const deadlineRange: Record<string, unknown> = {};
  if (filters.deadlineFrom) {
    const d = new Date(filters.deadlineFrom);
    if (!isNaN(d.getTime())) deadlineRange.gte = d;
  }
  if (filters.deadlineTo) {
    const d = new Date(filters.deadlineTo);
    if (!isNaN(d.getTime())) deadlineRange.lte = d;
  }
  if (Object.keys(deadlineRange).length > 0) fieldFilters.deadline = deadlineRange;

  const where = { ...owner, ...archivedFilter, ...searchFilter, ...fieldFilters };

  // Sort — allowlist with priority special-casing (priority is not alphabetical)
  const sortKey = sortBy in SORT_ALLOWLIST ? sortBy : "updatedAt";

  if (sortKey === "priority") {
    // Priority needs a custom sort — Prisma can't order by a mapped value.
    // We fetch all matching ids sorted by priority in JS, then paginate.
    const allRows = await prisma.application.findMany({
      where,
      select: { id: true, priority: true },
    });
    const sortedIds = allRows
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 0;
        const pb = PRIORITY_ORDER[b.priority] ?? 0;
        return sortOrder === "asc" ? pa - pb : pb - pa;
      })
      .map((r) => r.id);
    const pageIds = sortedIds.slice((page - 1) * pageSize, page * pageSize);
    const rows = await prisma.application.findMany({
      where: { id: { in: pageIds } },
      select: APPLICATION_SELECT,
    });
    // Re-sort to match the id order
    const rowMap = new Map(rows.map((r) => [r.id, r]));
    const orderedRows = pageIds.map((id) => rowMap.get(id)!).filter(Boolean);
    return {
      rows: orderedRows.map((r) => mapApplicationRow(r as ApplicationWithRelations)),
      total: sortedIds.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(sortedIds.length / pageSize)),
    };
  }

  const orderBy: Record<string, "asc" | "desc">[] = [{ ...SORT_ALLOWLIST[sortKey] }];
  if (sortOrder === "desc" && sortKey !== "createdAt" && sortKey !== "updatedAt") {
    const key = Object.keys(orderBy[0])[0];
    orderBy[0] = { [key]: "desc" };
  }
  // createdAt / updatedAt default to desc in the allowlist; flip to asc if requested
  if (sortOrder === "asc" && (sortKey === "createdAt" || sortKey === "updatedAt")) {
    orderBy[0] = { [sortKey]: "asc" };
  }

  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: APPLICATION_SELECT,
    }),
    prisma.application.count({ where }),
  ]);

  return {
    rows: rows.map((r) => mapApplicationRow(r as ApplicationWithRelations)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ─────────────────────────────────────────────
// Kanban — grouped by stage, no pagination (capped per stage)
// ─────────────────────────────────────────────

export type KanbanColumn = {
  stage: string;
  count: number;
  cards: ApplicationRow[];
};

export async function getKanbanBoard(
  scope: EmployeeScope,
  filters: Omit<ApplicationListFilters, "stage"> = {},
  perColumn = 50,
): Promise<KanbanColumn[]> {
  const owner = applicationCaseScope(scope);
  const archivedFilter = filters.archived
    ? { archivedAt: { not: null } }
    : { archivedAt: null };

  const fieldFilters: Record<string, unknown> = {};
  if (filters.status) fieldFilters.status = filters.status;
  if (filters.priority) fieldFilters.priority = filters.priority;
  if (filters.countryId) fieldFilters.countryId = filters.countryId;
  if (filters.universityId) fieldFilters.universityId = filters.universityId;
  if (filters.courseId) fieldFilters.courseId = filters.courseId;
  if (filters.intakeId) fieldFilters.intakeId = filters.intakeId;
  if (filters.assignedEmployeeId) fieldFilters.assignedEmployeeId = filters.assignedEmployeeId;

  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { applicationNumber: { contains: search, mode: "insensitive" as const } },
          { student: { firstName: { contains: search, mode: "insensitive" as const } } },
          { student: { lastName: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const where = { ...owner, ...archivedFilter, ...searchFilter, ...fieldFilters };

  const rows = await prisma.application.findMany({
    where,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: perColumn * APPLICATION_STAGES.length,
    select: APPLICATION_SELECT,
  });

  const mapped = rows.map((r) => mapApplicationRow(r as ApplicationWithRelations));
  const byStage = new Map<string, ApplicationRow[]>();
  for (const r of mapped) {
    const list = byStage.get(r.stageKey) ?? [];
    list.push(r);
    byStage.set(r.stageKey, list);
  }

  return APPLICATION_STAGES.map((stage) => ({
    stage,
    count: byStage.get(stage)?.length ?? 0,
    cards: byStage.get(stage) ?? [],
  }));
}

// ─────────────────────────────────────────────
// Detail — single application with full relations
// ─────────────────────────────────────────────

const APPLICATION_SELECT = {
  id: true,
  applicationNumber: true,
  stageKey: true,
  status: true,
  priority: true,
  deadline: true,
  archivedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  student: { select: { id: true, firstName: true, lastName: true, studentId: true, email: true, phone: true } },
  country: { select: { name: true } },
  university: { select: { name: true } },
  course: { select: { name: true } },
  intake: { select: { name: true, deadline: true } },
  assignedEmployee: { select: { id: true, user: { select: { name: true } } } },
  tasks: {
    where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { not: null } },
    orderBy: { dueDate: "asc" as const },
    take: 1,
    select: { dueDate: true, title: true },
  },
} satisfies Record<string, unknown>;

type ApplicationWithRelations = {
  id: string;
  applicationNumber: string;
  stageKey: string;
  status: string;
  priority: string;
  deadline: Date | null;
  archivedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string; email: string; phone: string | null };
  country: { name: string } | null;
  university: { name: string } | null;
  course: { name: string } | null;
  intake: { name: string; deadline: Date | null } | null;
  assignedEmployee: { id: string; user: { name: string } } | null;
  tasks: { dueDate: Date; title: string }[];
};

function mapApplicationRow(r: ApplicationWithRelations): ApplicationRow {
  const taskDeadline = r.tasks[0]?.dueDate ?? null;
  const intakeDeadline = r.intake?.deadline ?? null;
  const appDeadline = r.deadline ?? null;
  const candidates = [taskDeadline, intakeDeadline, appDeadline].filter((d): d is Date => d !== null);
  const nextDeadline = candidates.length > 0
    ? candidates.sort((a, b) => a.getTime() - b.getTime())[0]
    : null;
  const nextAction = r.tasks[0]?.title ?? null;
  return {
    id: r.id,
    applicationNumber: r.applicationNumber,
    stageKey: r.stageKey,
    status: r.status,
    priority: r.priority,
    deadline: r.deadline,
    archivedAt: r.archivedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    student: r.student,
    country: r.country,
    university: r.university,
    course: r.course,
    intake: r.intake,
    assignedEmployee: r.assignedEmployee,
    nextDeadline,
    nextAction,
  };
}

// ─────────────────────────────────────────────
// Detail — full application with all relations for the detail page
// ─────────────────────────────────────────────

export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationById>>>;

export async function getApplicationById(
  scope: EmployeeScope,
  id: string,
): Promise<{
  id: string;
  applicationNumber: string;
  stageKey: string;
  status: string;
  priority: string;
  deadline: Date | null;
  archivedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string;
    email: string;
    phone: string | null;
  };
  country: { id: string; name: string } | null;
  university: { id: string; name: string } | null;
  course: { id: string; name: string } | null;
  intake: { id: string; name: string; deadline: Date | null } | null;
  assignedEmployee: { id: string; title: string | null; user: { name: string; email: string } } | null;
  documents: {
    id: string; name: string; status: string; uploadedAt: Date | null; reviewedAt: Date | null;
  }[];
  tasks: {
    id: string; title: string; status: string; priority: string; dueDate: Date | null; createdAt: Date;
  }[];
  visaApplications: {
    id: string; stage: string; visaType: string | null; submittedAt: Date | null; decisionAt: Date | null;
  }[];
  payments: {
    id: string; amount: number; currency: string; status: string; paymentDate: Date | null;
  }[];
  invoices: {
    id: string; invoiceNumber: string; amount: number; currency: string; status: string; dueDate: Date | null;
  }[];
  stageHistory: {
    id: string; fromStage: string | null; toStage: string; note: string | null; changedById: string; createdAt: Date;
  }[];
} | null> {
  const owner = applicationCaseScope(scope);

  const app = await prisma.application.findFirst({
    where: { id, ...owner },
    select: {
      id: true,
      applicationNumber: true,
      stageKey: true,
      status: true,
      priority: true,
      deadline: true,
      archivedAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      student: { select: { id: true, firstName: true, lastName: true, studentId: true, email: true, phone: true } },
      country: { select: { id: true, name: true } },
      university: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      intake: { select: { id: true, name: true, deadline: true } },
      assignedEmployee: { select: { id: true, title: true, user: { select: { name: true, email: true } } } },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, status: true, uploadedAt: true, reviewedAt: true },
      },
      tasks: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, priority: true, dueDate: true, createdAt: true },
      },
      visaApplications: {
        orderBy: { createdAt: "desc" },
        select: { id: true, stage: true, visaType: true, submittedAt: true, decisionAt: true },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, currency: true, status: true, paymentDate: true },
      },
      invoices: {
        orderBy: { issueDate: "desc" },
        select: { id: true, invoiceNumber: true, amount: true, currency: true, status: true, dueDate: true },
      },
      stageHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, fromStage: true, toStage: true, note: true, changedById: true, createdAt: true },
      },
    },
  });

  return app;
}

export async function requireApplication(scope: EmployeeScope, id: string) {
  const app = await getApplicationById(scope, id);
  if (!app) throw new HttpError(404, "NOT_FOUND", "Application not found");
  return app;
}

// ─────────────────────────────────────────────
// Stage transition — validated + audit-logged
// ─────────────────────────────────────────────

export async function changeApplicationStage(
  scope: EmployeeScope,
  id: string,
  toStage: string,
  actor: { id: string },
  note?: string,
): Promise<{ fromStage: string; toStage: string }> {
  // Validate the target stage is in the canonical list
  if (!APPLICATION_STAGES.includes(toStage as (typeof APPLICATION_STAGES)[number])) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid stage: ${toStage}`);
  }

  // IDOR closure: resolve via scope filter
  const owner = applicationCaseScope(scope);
  const app = await prisma.application.findFirst({
    where: { id, ...owner },
    select: { id: true, stageKey: true },
  });
  if (!app) throw new HttpError(404, "NOT_FOUND", "Application not found");

  if (app.stageKey === toStage) {
    // No-op — return current state without writing a history row
    return { fromStage: app.stageKey, toStage };
  }

  await prisma.$transaction([
    prisma.application.update({
      where: { id },
      data: { stageKey: toStage, updatedAt: new Date() },
    }),
    prisma.applicationStageHistory.create({
      data: {
        applicationId: id,
        fromStage: app.stageKey,
        toStage,
        changedById: actor.id,
        note: note ?? null,
      },
    }),
  ]);

  return { fromStage: app.stageKey, toStage };
}

// ─────────────────────────────────────────────
// Assign / reassign
// ─────────────────────────────────────────────

export async function assignApplication(
  scope: EmployeeScope,
  id: string,
  employeeId: string | null,
  _actor: { id: string },
): Promise<void> {
  const owner = applicationCaseScope(scope);
  const app = await prisma.application.findFirst({
    where: { id, ...owner },
    select: { id: true, assignedEmployeeId: true },
  });
  if (!app) throw new HttpError(404, "NOT_FOUND", "Application not found");

  // When assigning to a specific employee, verify they exist
  if (employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new HttpError(400, "BAD_REQUEST", "Target employee not found");
  }

  await prisma.application.update({
    where: { id },
    data: { assignedEmployeeId: employeeId, updatedAt: new Date() },
  });
}

// ─────────────────────────────────────────────
// Priority change
// ─────────────────────────────────────────────

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export async function changeApplicationPriority(
  scope: EmployeeScope,
  id: string,
  priority: string,
): Promise<void> {
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid priority: ${priority}`);
  }

  const owner = applicationCaseScope(scope);
  const app = await prisma.application.findFirst({
    where: { id, ...owner },
    select: { id: true },
  });
  if (!app) throw new HttpError(404, "NOT_FOUND", "Application not found");

  await prisma.application.update({
    where: { id },
    data: { priority, updatedAt: new Date() },
  });
}
