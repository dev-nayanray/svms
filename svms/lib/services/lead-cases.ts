import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { leadScope } from "@/lib/services/employee-dashboard";
import { titleCase, slugify } from "@/lib/utils";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { emitNotification } from "@/lib/services/notification-cases";

/**
 * Employee Lead Management service.
 *
 * IDOR: EMPLOYEE sees leads assigned to them. ADMIN sees all.
 */

export const LEAD_STATUSES = ["NEW", "CONTACTED", "COUNSELING", "QUALIFIED", "CONVERTED", "LOST"] as const;
export const LEAD_SOURCES = ["WEBSITE", "FACEBOOK", "WHATSAPP", "REFERRAL", "WALK_IN", "CAMPAIGN", "AGENT", "OTHER"] as const;

// ─── Types ───

export type LeadListFilters = {
  search?: string;
  status?: string;
  source?: string;
  employeeId?: string;
};

export type LeadRow = {
  id: string; name: string; phone: string | null; email: string | null;
  source: string | null; interestedCountry: string | null; preferredCourse: string | null;
  status: string; nextFollowUp: Date | null; createdAt: Date; updatedAt: Date;
  assignedEmployee: { id: string; name: string } | null;
};

export type LeadListResult = {
  rows: LeadRow[]; total: number; page: number; pageSize: number; totalPages: number;
};

export type LeadDetail = {
  id: string; name: string; phone: string | null; email: string | null;
  interestedCountry: string | null; preferredCourse: string | null;
  status: string; source: string | null; notes: string | null;
  nextFollowUp: Date | null; convertedStudentId: string | null;
  createdAt: Date; updatedAt: Date;
  assignedEmployee: { id: string; name: string } | null;
  leadNotes: { id: string; body: string; authorId: string; createdAt: Date }[];
  tasks: { id: string; title: string; status: string; priority: string; dueDate: Date | null }[];
  appointments: { id: string; title: string; type: string; scheduledAt: Date; status: string }[];
};

// ─── List ───

export async function listLeads(
  scope: EmployeeScope,
  params: { filters?: LeadListFilters; page?: number; pageSize?: number } = {},
): Promise<LeadListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};
  const owner = leadScope(scope);

  const fieldFilters: Record<string, unknown> = {};
  if (filters.status) fieldFilters.status = filters.status;
  if (filters.source) fieldFilters.source = filters.source;
  if (filters.employeeId) fieldFilters.assignedEmployeeId = filters.employeeId;

  const search = filters.search?.trim();
  const searchFilter = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }, { phone: { contains: search } }] }
    : {};

  const where = { ...owner, ...searchFilter, ...fieldFilters };

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where, orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, name: true, phone: true, email: true, source: true,
        interestedCountry: true, preferredCourse: true, status: true,
        nextFollowUp: true, createdAt: true, updatedAt: true,
        assignedEmployee: { select: { id: true, user: { select: { name: true } } } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  const mapped: LeadRow[] = rows.map((l) => ({
    ...l,
    assignedEmployee: l.assignedEmployee ? { id: l.assignedEmployee.id, name: l.assignedEmployee.user.name } : null,
  }));

  return { rows: mapped, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ─── Detail ───

export async function getLeadById(scope: EmployeeScope, id: string): Promise<LeadDetail | null> {
  const owner = leadScope(scope);
  const lead = await prisma.lead.findFirst({
    where: { id, ...owner },
    select: {
      id: true, name: true, phone: true, email: true,
      interestedCountry: true, preferredCourse: true, status: true,
      source: true, notes: true, nextFollowUp: true, convertedStudentId: true,
      createdAt: true, updatedAt: true,
      assignedEmployee: { select: { id: true, user: { select: { name: true } } } },
      leadNotes: { orderBy: { createdAt: "desc" }, select: { id: true, body: true, authorId: true, createdAt: true } },
    },
  });
  if (!lead) return null;

  // Fetch tasks + appointments linked via the student (if converted) or by name match
  let tasks: LeadDetail["tasks"] = [];
  let appointments: LeadDetail["appointments"] = [];
  if (lead.convertedStudentId) {
    [tasks, appointments] = await Promise.all([
      prisma.task.findMany({
        where: { studentId: lead.convertedStudentId, status: { in: ["TODO", "IN_PROGRESS"] } },
        orderBy: { dueDate: "asc" }, take: 5,
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
      }),
      prisma.appointment.findMany({
        where: { studentId: lead.convertedStudentId, status: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" }, take: 5,
        select: { id: true, title: true, type: true, scheduledAt: true, status: true },
      }),
    ]);
  }

  return {
    ...lead,
    assignedEmployee: lead.assignedEmployee ? { id: lead.assignedEmployee.id, name: lead.assignedEmployee.user.name } : null,
    tasks, appointments,
  };
}

export async function requireLead(scope: EmployeeScope, id: string): Promise<LeadDetail> {
  const l = await getLeadById(scope, id);
  if (!l) throw new HttpError(404, "NOT_FOUND", "Lead not found");
  return l;
}

// ─── Create ───

export async function createLead(
  scope: EmployeeScope,
  input: {
    name: string; phone?: string; email?: string;
    interestedCountry?: string; preferredCourse?: string;
    source?: string; notes?: string; nextFollowUp?: Date;
  },
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<{ id: string }> {
  if (!input.name?.trim()) throw new HttpError(422, "VALIDATION_ERROR", "Name is required");

  const lead = await prisma.lead.create({
    data: {
      name: input.name.trim(),
      phone: input.phone || null,
      email: input.email?.toLowerCase() || null,
      interestedCountry: input.interestedCountry || null,
      preferredCourse: input.preferredCourse || null,
      source: input.source || null,
      notes: input.notes || null,
      nextFollowUp: input.nextFollowUp || null,
      status: "NEW",
      assignedEmployeeId: scope.employeeId,
    },
  });

  try {
    await prisma.auditLog.create({
      data: { userId: actor.id, action: "lead.created", entity: "Lead", entityId: lead.id, newValue: { name: lead.name } as object, ipAddress: actor.ipAddress, userAgent: actor.userAgent },
    });
  } catch (err) { console.error("[lead-create] audit failed", err); }

  return { id: lead.id };
}

// ─── Update ───

export async function updateLead(
  scope: EmployeeScope,
  id: string,
  input: {
    name?: string; phone?: string; email?: string;
    interestedCountry?: string; preferredCourse?: string;
    source?: string; notes?: string; nextFollowUp?: Date | null;
  },
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  const owner = leadScope(scope);
  const lead = await prisma.lead.findFirst({ where: { id, ...owner }, select: { id: true } });
  if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.phone !== undefined) data.phone = input.phone || null;
  if (input.email !== undefined) data.email = input.email?.toLowerCase() || null;
  if (input.interestedCountry !== undefined) data.interestedCountry = input.interestedCountry || null;
  if (input.preferredCourse !== undefined) data.preferredCourse = input.preferredCourse || null;
  if (input.source !== undefined) data.source = input.source || null;
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.nextFollowUp !== undefined) data.nextFollowUp = input.nextFollowUp;

  await prisma.lead.update({ where: { id }, data: { ...data, updatedAt: new Date() } });

  try {
    await prisma.auditLog.create({
      data: { userId: actor.id, action: "lead.updated", entity: "Lead", entityId: id, newValue: data as object, ipAddress: actor.ipAddress, userAgent: actor.userAgent },
    });
  } catch (err) { console.error("[lead-update] audit failed", err); }
}

// ─── Status change ───

export async function changeLeadStatus(
  scope: EmployeeScope,
  id: string,
  newStatus: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  if (!LEAD_STATUSES.includes(newStatus as (typeof LEAD_STATUSES)[number])) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid status: ${newStatus}`);
  }

  const owner = leadScope(scope);
  const lead = await prisma.lead.findFirst({ where: { id, ...owner }, select: { id: true, status: true, name: true } });
  if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

  if (lead.status === newStatus) return; // no-op

  // Cannot change status of CONVERTED leads (they're now students)
  if (lead.status === "CONVERTED") {
    throw new HttpError(409, "CONFLICT", "Cannot change status of a converted lead");
  }

  await prisma.lead.update({ where: { id }, data: { status: newStatus, updatedAt: new Date() } });

  try {
    await prisma.auditLog.create({
      data: { userId: actor.id, action: "lead.status_changed", entity: "Lead", entityId: id,
        oldValue: { status: lead.status } as object, newValue: { status: newStatus } as object,
        ipAddress: actor.ipAddress, userAgent: actor.userAgent },
    });
  } catch (err) { console.error("[lead-status] audit failed", err); }
}

// ─── Conversion ───

export async function convertLeadToStudent(
  scope: EmployeeScope,
  id: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<{ studentId: string; tempPassword: string }> {
  const owner = leadScope(scope);
  const lead = await prisma.lead.findFirst({
    where: { id, ...owner },
    select: { id: true, name: true, phone: true, email: true, interestedCountry: true, status: true, convertedStudentId: true, assignedEmployeeId: true },
  });
  if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

  // Already converted?
  if (lead.convertedStudentId) {
    throw new HttpError(409, "CONFLICT", "Lead has already been converted to a student");
  }

  // Must be QUALIFIED before conversion
  if (lead.status !== "QUALIFIED") {
    throw new HttpError(409, "CONFLICT", "Lead must be in QUALIFIED status before conversion");
  }

  // Duplicate check — email or phone match against existing students
  if (lead.email) {
    const existingStudent = await prisma.student.findFirst({
      where: { email: lead.email },
      select: { id: true },
    });
    if (existingStudent) {
      throw new HttpError(409, "CONFLICT", `A student with email ${lead.email} already exists`);
    }
  }

  // Create user + student in a transaction
  const email = lead.email ?? `${slugify(lead.name)}@lead.euroscope.example`;
  // SECURITY: generate a random per-conversion temp password. The
  // previous hardcoded "ChangeMe@123" was a known exploit — anyone who
  // learned the convention could sign in as any freshly-converted
  // student before the student changed it. The new password is
  // returned to the converting employee (who shares it out-of-band)
  // and the account is flagged with mustChangePassword=true so the
  // student is forced to set their own password on first login.
  const tempPassword = crypto.randomBytes(9).toString("base64url").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const year = new Date().getFullYear();
  const studentCount = await prisma.student.count();
  const studentId = `STD-${year}-${String(studentCount + 1).padStart(6, "0")}`;

  const [user, student] = await prisma.$transaction([
    prisma.user.create({
      data: {
        name: lead.name,
        email,
        phone: lead.phone,
        passwordHash,
        roleName: "STUDENT",
        status: "ACTIVE",
        // Force password change on first login — the temp password is
        // a one-time credential shared out-of-band by the converting
        // employee. The student must set their own password before
        // they can do anything else.
        mustChangePassword: true,
      },
    }),
    prisma.student.create({
      data: {
        userId: "", // will be set after transaction — but Prisma doesn't support
        studentId,
        firstName: lead.name.split(" ")[0] ?? lead.name,
        lastName: lead.name.split(" ").slice(1).join(" ") || "-",
        email,
        phone: lead.phone,
        country: lead.interestedCountry,
        assignedEmployeeId: lead.assignedEmployeeId,
      },
    }),
  ]);

  // Link user to student
  await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });

  // Mark lead as CONVERTED
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "CONVERTED", convertedStudentId: student.id, updatedAt: new Date() },
  });

  // Audit log — include the fact that a temp password was generated,
  // but NEVER log the password itself. The password is returned to
  // the converting employee in the API response so they can share it
  // out-of-band with the student.
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id, action: "lead.converted", entity: "Lead", entityId: lead.id,
        oldValue: { status: "QUALIFIED" } as object,
        newValue: { status: "CONVERTED", studentId: student.id, tempPasswordGenerated: true } as object,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) { console.error("[lead-convert] audit failed", err); }

  // Notify the new student
  await emitNotification({
    userId: user.id,
    type: "WELCOME",
    title: "Welcome to Euroscope!",
    message: `Your account has been created. Use your email ${email} to log in.`,
    link: "/student",
    entityType: "Student",
    entityId: student.id,
  });

  return { studentId: student.id, tempPassword };
}

// ─── Notes ───

export async function addLeadNote(
  scope: EmployeeScope,
  id: string,
  body: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<{ id: string }> {
  if (!body.trim()) throw new HttpError(422, "VALIDATION_ERROR", "Note cannot be empty");

  const owner = leadScope(scope);
  const lead = await prisma.lead.findFirst({ where: { id, ...owner }, select: { id: true } });
  if (!lead) throw new HttpError(404, "NOT_FOUND", "Lead not found");

  const note = await prisma.leadNote.create({
    data: { leadId: id, authorId: actor.id, body: body.trim() },
  });
  return { id: note.id };
}
