import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { appointmentScope } from "@/lib/services/employee-dashboard";
import { emitNotification } from "@/lib/services/notification-cases";

/**
 * Employee Appointment Management service — server-side data layer for
 * /employee/appointments and the appointment CRUD APIs.
 *
 * IDOR closure: EMPLOYEE sees appointments on students assigned to them.
 * ADMIN sees all. Foreign appointments return 404 (never 403).
 *
 * Timezone: scheduledAt is stored as UTC DateTime in MongoDB. The service
 * accepts ISO 8601 strings (which carry timezone info) and converts to
 * Date objects server-side. The UI formats in the user's timezone via
 * Intl.DateTimeFormat. All date comparisons (today, upcoming, past) use
 * server-side UTC — no client-side timezone math.
 */

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

export const APPOINTMENT_TYPES = [
  "COUNSELING",
  "DOCUMENT_REVIEW",
  "UNIVERSITY_CONSULTATION",
  "VISA_CONSULTATION",
  "BIOMETRICS_PREPARATION",
  "INTERVIEW_PREPARATION",
  "OTHER",
] as const;

export const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
] as const;

export const APPOINTMENT_VIEWS = ["upcoming", "today", "past", "cancelled", "all"] as const;
export type AppointmentView = (typeof APPOINTMENT_VIEWS)[number];

export const TYPE_LABELS: Record<string, string> = {
  COUNSELING: "Counseling",
  DOCUMENT_REVIEW: "Document Review",
  UNIVERSITY_CONSULTATION: "University Consultation",
  VISA_CONSULTATION: "Visa Consultation",
  BIOMETRICS_PREPARATION: "Biometrics Preparation",
  INTERVIEW_PREPARATION: "Interview Preparation",
  OTHER: "Other",
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type AppointmentListFilters = {
  search?: string;
  type?: string;
  status?: string;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type AppointmentRow = {
  id: string;
  title: string;
  type: string;
  scheduledAt: Date;
  durationMinutes: number;
  location: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  application: { id: string; applicationNumber: string } | null;
  employee: { id: string; name: string } | null;
};

export type AppointmentListResult = {
  rows: AppointmentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: Record<AppointmentView, number>;
};

// ─────────────────────────────────────────────
// List — views + filters + pagination
// ─────────────────────────────────────────────

export async function listAppointments(
  scope: EmployeeScope,
  params: {
    view?: AppointmentView;
    filters?: AppointmentListFilters;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<AppointmentListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const view = params.view ?? "upcoming";
  const filters = params.filters ?? {};
  const now = new Date();
  const owner = appointmentScope(scope);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // Build base where from filters
  const fieldFilters: Record<string, unknown> = {};
  if (filters.type) fieldFilters.type = filters.type;
  if (filters.studentId) fieldFilters.studentId = filters.studentId;

  const search = filters.search?.trim();
  const searchFilter = search
    ? { title: { contains: search, mode: "insensitive" as const } }
    : {};

  const dateRange: Record<string, unknown> = {};
  if (filters.dateFrom) {
    const d = new Date(filters.dateFrom);
    if (!isNaN(d.getTime())) dateRange.gte = d;
  }
  if (filters.dateTo) {
    const d = new Date(filters.dateTo);
    if (!isNaN(d.getTime())) dateRange.lte = d;
  }
  if (Object.keys(dateRange).length > 0) fieldFilters.scheduledAt = dateRange;

  const baseWhere: Record<string, unknown> = { ...owner, ...searchFilter, ...fieldFilters };

  // Apply view-specific filters
  let viewWhere: Record<string, unknown> = { ...baseWhere };
  if (view === "upcoming") {
    viewWhere = { ...baseWhere, status: "SCHEDULED", scheduledAt: { gt: endOfToday } };
  } else if (view === "today") {
    viewWhere = { ...baseWhere, status: "SCHEDULED", scheduledAt: { gte: startOfToday, lte: endOfToday } };
  } else if (view === "past") {
    viewWhere = { ...baseWhere, status: { in: ["SCHEDULED", "COMPLETED"] }, scheduledAt: { lt: startOfToday } };
  } else if (view === "cancelled") {
    viewWhere = { ...baseWhere, status: "CANCELLED" };
  }

  const [rows, total, countUpcoming, countToday, countPast, countCancelled, countAll] = await Promise.all([
    prisma.appointment.findMany({
      where: viewWhere,
      orderBy: [
        { scheduledAt: view === "past" ? "desc" : "asc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, title: true, type: true, scheduledAt: true, durationMinutes: true,
        location: true, status: true, notes: true, createdAt: true, updatedAt: true,
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        application: { select: { id: true, applicationNumber: true } },
        employee: { select: { id: true, user: { select: { name: true } } } },
      },
    }),
    prisma.appointment.count({ where: viewWhere }),
    prisma.appointment.count({ where: { ...baseWhere, status: "SCHEDULED", scheduledAt: { gt: endOfToday } } }),
    prisma.appointment.count({ where: { ...baseWhere, status: "SCHEDULED", scheduledAt: { gte: startOfToday, lte: endOfToday } } }),
    prisma.appointment.count({ where: { ...baseWhere, status: { in: ["SCHEDULED", "COMPLETED"] }, scheduledAt: { lt: startOfToday } } }),
    prisma.appointment.count({ where: { ...baseWhere, status: "CANCELLED" } }),
    prisma.appointment.count({ where: { ...baseWhere } }),
  ]);

  const mapped: AppointmentRow[] = rows.map((a) => ({
    id: a.id, title: a.title, type: a.type, scheduledAt: a.scheduledAt,
    durationMinutes: a.durationMinutes, location: a.location, status: a.status,
    notes: a.notes, createdAt: a.createdAt, updatedAt: a.updatedAt,
    student: a.student,
    application: a.application,
    employee: a.employee ? { id: a.employee.id, name: a.employee.user.name } : null,
  }));

  return {
    rows: mapped, total, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: { upcoming: countUpcoming, today: countToday, past: countPast, cancelled: countCancelled, all: countAll },
  };
}

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

export async function createAppointment(
  scope: EmployeeScope,
  input: {
    studentId: string;
    applicationId?: string;
    type: string;
    title: string;
    scheduledAt: Date;
    durationMinutes?: number;
    location?: string;
    notes?: string;
  },
  _actor: { id: string },
): Promise<{ id: string }> {
  // Validate type
  if (!APPOINTMENT_TYPES.includes(input.type as (typeof APPOINTMENT_TYPES)[number])) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid appointment type: ${input.type}`);
  }

  // IDOR: EMPLOYEE can only create appointments for their own students
  if (!scope.isAdmin) {
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, assignedEmployee: { userId: scope.userId } },
      select: { id: true, userId: true, firstName: true, lastName: true },
    });
    if (!student) throw new HttpError(403, "FORBIDDEN", "You can only create appointments for your own students");
  }

  // Duplicate booking check — same student, same time, SCHEDULED status
  const existing = await prisma.appointment.findFirst({
    where: {
      studentId: input.studentId,
      scheduledAt: input.scheduledAt,
      status: "SCHEDULED",
    },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, "CONFLICT", "An appointment already exists for this student at the same time");
  }

  const appointment = await prisma.appointment.create({
    data: {
      studentId: input.studentId,
      applicationId: input.applicationId ?? null,
      employeeId: scope.employeeId,
      type: input.type,
      title: input.title,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes ?? 30,
      location: input.location ?? null,
      notes: input.notes ?? null,
      status: "SCHEDULED",
    },
  });

  // Notify the student
  try {
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { userId: true, firstName: true, lastName: true },
    });
    if (student) {
      await emitNotification({
        userId: student.userId,
        type: "APPOINTMENT_CREATED",
        title: `New appointment: ${input.title}`,
        message: `An appointment has been scheduled for ${input.scheduledAt.toISOString()}.`,
        link: "/employee/appointments",
        entityType: "Appointment",
        entityId: appointment.id,
      });
    }
  } catch (err) {
    console.error("[appointment-create] notification failed", err);
  }

  return { id: appointment.id };
}

export async function rescheduleAppointment(
  scope: EmployeeScope,
  id: string,
  newScheduledAt: Date,
  _actor: { id: string },
): Promise<void> {
  const owner = appointmentScope(scope);
  const appt = await prisma.appointment.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, scheduledAt: true, studentId: true, title: true },
  });
  if (!appt) throw new HttpError(404, "NOT_FOUND", "Appointment not found");
  if (appt.status === "CANCELLED") throw new HttpError(409, "CONFLICT", "Cannot reschedule a cancelled appointment");
  if (appt.status === "COMPLETED") throw new HttpError(409, "CONFLICT", "Cannot reschedule a completed appointment");

  // Duplicate check at new time
  const conflict = await prisma.appointment.findFirst({
    where: { studentId: appt.studentId, scheduledAt: newScheduledAt, status: "SCHEDULED", id: { not: id } },
    select: { id: true },
  });
  if (conflict) throw new HttpError(409, "CONFLICT", "Another appointment already exists for this student at that time");

  await prisma.appointment.update({
    where: { id },
    data: { scheduledAt: newScheduledAt, status: "RESCHEDULED", updatedAt: new Date() },
  });

  // Notify the student
  try {
    const student = await prisma.student.findUnique({ where: { id: appt.studentId }, select: { userId: true } });
    if (student) {
      await emitNotification({
        userId: student.userId,
        type: "APPOINTMENT_RESCHEDULED",
        title: `Appointment rescheduled: ${appt.title}`,
        message: `Your appointment has been rescheduled to ${newScheduledAt.toISOString()}.`,
        link: "/employee/appointments",
        entityType: "Appointment",
        entityId: id,
      });
    }
  } catch (err) {
    console.error("[appointment-reschedule] notification failed", err);
  }
}

export async function cancelAppointment(
  scope: EmployeeScope,
  id: string,
  _actor: { id: string },
): Promise<void> {
  const owner = appointmentScope(scope);
  const appt = await prisma.appointment.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, studentId: true, title: true },
  });
  if (!appt) throw new HttpError(404, "NOT_FOUND", "Appointment not found");
  if (appt.status === "CANCELLED") return; // no-op
  if (appt.status === "COMPLETED") throw new HttpError(409, "CONFLICT", "Cannot cancel a completed appointment");

  await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED", updatedAt: new Date() } });

  try {
    const student = await prisma.student.findUnique({ where: { id: appt.studentId }, select: { userId: true } });
    if (student) {
      await emitNotification({
        userId: student.userId,
        type: "APPOINTMENT_CANCELLED",
        title: `Appointment cancelled: ${appt.title}`,
        message: `Your appointment has been cancelled.`,
        link: "/employee/appointments",
        entityType: "Appointment",
        entityId: id,
      });
    }
  } catch (err) {
    console.error("[appointment-cancel] notification failed", err);
  }
}

export async function completeAppointment(
  scope: EmployeeScope,
  id: string,
  _actor: { id: string },
): Promise<void> {
  const owner = appointmentScope(scope);
  const appt = await prisma.appointment.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true },
  });
  if (!appt) throw new HttpError(404, "NOT_FOUND", "Appointment not found");
  if (appt.status === "COMPLETED") return; // no-op
  if (appt.status === "CANCELLED") throw new HttpError(409, "CONFLICT", "Cannot complete a cancelled appointment");

  await prisma.appointment.update({ where: { id }, data: { status: "COMPLETED", updatedAt: new Date() } });
}

export async function confirmAppointment(
  scope: EmployeeScope,
  id: string,
  _actor: { id: string },
): Promise<void> {
  const owner = appointmentScope(scope);
  const appt = await prisma.appointment.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, studentId: true, title: true },
  });
  if (!appt) throw new HttpError(404, "NOT_FOUND", "Appointment not found");
  if (appt.status === "CANCELLED") throw new HttpError(409, "CONFLICT", "Cannot confirm a cancelled appointment");
  // Confirm = set status back to SCHEDULED from RESCHEDULED (re-confirm after reschedule)
  if (appt.status === "RESCHEDULED") {
    await prisma.appointment.update({ where: { id }, data: { status: "SCHEDULED", updatedAt: new Date() } });

    try {
      const student = await prisma.student.findUnique({ where: { id: appt.studentId }, select: { userId: true } });
      if (student) {
        await emitNotification({
          userId: student.userId,
          type: "APPOINTMENT_CONFIRMED",
          title: `Appointment confirmed: ${appt.title}`,
          message: `Your appointment has been confirmed.`,
          link: "/employee/appointments",
          entityType: "Appointment",
          entityId: id,
        });
      }
    } catch (err) {
      console.error("[appointment-confirm] notification failed", err);
    }
  }
}

export async function addNote(
  scope: EmployeeScope,
  id: string,
  note: string,
  _actor: { id: string },
): Promise<void> {
  if (!note.trim()) throw new HttpError(422, "VALIDATION_ERROR", "Note cannot be empty");

  const owner = appointmentScope(scope);
  const appt = await prisma.appointment.findFirst({
    where: { id, ...owner },
    select: { id: true, notes: true },
  });
  if (!appt) throw new HttpError(404, "NOT_FOUND", "Appointment not found");

  const existingNote = appt.notes ?? "";
  const newNote = existingNote ? `${existingNote}\n\n${note.trim()}` : note.trim();

  await prisma.appointment.update({ where: { id }, data: { notes: newNote, updatedAt: new Date() } });
}
