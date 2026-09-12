import { prisma } from "@/lib/db";
import { STUDENT_LIST_MAX_ROWS } from "@/lib/constants/pagination";
import { HttpError } from "@/lib/api";
import { auditLog } from "./audit";
import { notifications } from "./notification";

/**
 * Student-scoped Appointments service for Module 15.
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session
 * (via `studentApiGuard()`). The service NEVER trusts an
 * `appointmentId` from the client without re-verifying that the
 * appointment's `studentId` matches the caller. Foreign/missing
 * records return null → 404.
 *
 * STUDENT PERMISSIONS
 * -------------------
 * Students can:
 *  - View their own appointments
 *  - Confirm a SCHEDULED appointment (→ CONFIRMED)
 *  - Cancel a SCHEDULED or CONFIRMED appointment (→ CANCELLED)
 *  - Request a reschedule (sends a notification to the counselor)
 *
 * Students CANNOT:
 *  - Create appointments (counselor/admin creates them)
 *  - Mark appointments as COMPLETED or NO_SHOW (admin only)
 *  - Modify the scheduled time, purpose, location, or any other field
 *  - Access other students' appointments
 */

export type AppointmentView = {
  id: string;
  scheduledAt: Date;
  durationMins: number;
  purpose: string;
  location: string | null;
  meetingMethod: string | null;
  meetingLink: string | null;
  status: string;
  statusLabel: string;
  notes: string | null;
  cancelReason: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  counselorName: string;
  counselorInitials: string;
  counselorId: string;
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

function buildView(row: {
  id: string;
  scheduledAt: Date;
  durationMins: number;
  purpose: string;
  location: string | null;
  meetingMethod: string | null;
  meetingLink: string | null;
  status: string;
  notes: string | null;
  cancelReason: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee: {
    user: { id: string; name: string };
  } | null;
}): AppointmentView {
  const counselorName = row.employee?.user?.name ?? "Counselor";
  return {
    id: row.id,
    scheduledAt: row.scheduledAt,
    durationMins: row.durationMins,
    purpose: row.purpose,
    location: row.location,
    meetingMethod: row.meetingMethod,
    meetingLink: row.meetingLink,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    notes: row.notes,
    cancelReason: row.cancelReason,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    counselorName,
    counselorInitials: getInitials(counselorName),
    counselorId: row.employee?.user?.id ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // NOTE: employeeId is intentionally omitted — internal ObjectId.
  };
}

export const studentAppointmentService = {
  /**
   * List the caller's appointments. Optional status filter.
   * Returns upcoming first (by scheduledAt asc for future, desc for past).
   */
  async list(
    studentId: string,
    filter: "upcoming" | "past" | "cancelled" | "all" = "all",
  ): Promise<AppointmentView[]> {
    const now = new Date();
    const where: Record<string, unknown> = {
      studentId,
    };

    if (filter === "upcoming") {
      where.status = { in: ["SCHEDULED", "CONFIRMED"] };
      where.scheduledAt = { gte: now };
    } else if (filter === "past") {
      where.OR = [
        { status: { in: ["COMPLETED", "NO_SHOW"] } },
        { status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledAt: { lt: now } },
      ];
    } else if (filter === "cancelled") {
      where.status = "CANCELLED";
    }

    const rows = await prisma.appointment.findMany({
      where,
      include: {
        employee: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: filter === "past" ? { scheduledAt: "desc" } : { scheduledAt: "asc" },
      take: STUDENT_LIST_MAX_ROWS,
    });

    return rows.map((r) => buildView(r as never));
  },

  /**
   * Get one appointment. Ownership verified: scoped by `studentId`.
   */
  async getById(studentId: string, appointmentId: string): Promise<AppointmentView | null> {
    const row = await prisma.appointment.findFirst({
      where: { id: appointmentId, studentId },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!row) return null;
    return buildView(row as never);
  },

  /**
   * Confirm a SCHEDULED appointment → CONFIRMED. Students can only
   * confirm appointments in SCHEDULED status. Ownership verified.
   */
  async confirm(studentId: string, appointmentId: string, userId?: string): Promise<AppointmentView> {
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, studentId },
      include: {
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!appt) {
      throw new HttpError(404, "NOT_FOUND", "Appointment not found");
    }

    if (appt.status !== "SCHEDULED") {
      throw new HttpError(
        409,
        "CONFLICT",
        `Cannot confirm an appointment in ${appt.status} status. Only SCHEDULED appointments can be confirmed.`,
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CONFIRMED" },
      include: {
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await auditLog.record({
      userId: userId ?? undefined, // H5 fix — use session userId, not studentId
      action: "appointment.confirmed",
      entity: "Appointment",
      entityId: appointmentId,
      oldValue: { status: "SCHEDULED" },
      newValue: { status: "CONFIRMED" },
    });

    // Notify the counselor
    const counselorUserId = appt.employee?.user?.id;
    if (counselorUserId) {
      await notifications.push({
        userId: counselorUserId,
        type: "APPOINTMENT_CONFIRMED",
        title: "Appointment confirmed",
        message: `The student has confirmed their appointment on ${appt.scheduledAt.toLocaleDateString()}.`,
        link: "/employee/students",
      });
    }

    return buildView(updated as never);
  },

  /**
   * Cancel a SCHEDULED or CONFIRMED appointment → CANCELLED.
   * Students can only cancel non-terminal appointments. Ownership verified.
   */
  async cancel(
    studentId: string,
    appointmentId: string,
    cancelReason?: string,
    userId?: string,
  ): Promise<AppointmentView> {
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, studentId },
      include: {
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!appt) {
      throw new HttpError(404, "NOT_FOUND", "Appointment not found");
    }

    if (appt.status === "COMPLETED" || appt.status === "CANCELLED" || appt.status === "NO_SHOW") {
      throw new HttpError(
        409,
        "CONFLICT",
        `Cannot cancel an appointment in ${appt.status} status.`,
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true, firstName: true, lastName: true },
    });

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: student?.userId ?? null,
        cancelReason: cancelReason ?? null,
      },
      include: {
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await auditLog.record({
      userId: userId ?? student?.userId ?? undefined, // H5 fix
      action: "appointment.cancelled",
      entity: "Appointment",
      entityId: appointmentId,
      oldValue: { status: appt.status },
      newValue: { status: "CANCELLED", cancelReason },
    });

    // Notify the counselor
    const counselorUserId = appt.employee?.user?.id;
    if (counselorUserId) {
      await notifications.push({
        userId: counselorUserId,
        type: "APPOINTMENT_CANCELLED",
        title: "Appointment cancelled",
        message: `${student?.firstName ?? "Student"} cancelled their appointment on ${appt.scheduledAt.toLocaleDateString()}${cancelReason ? `. Reason: ${cancelReason}` : ""}.`,
        link: "/employee/students",
      });
    }

    return buildView(updated as never);
  },
};
