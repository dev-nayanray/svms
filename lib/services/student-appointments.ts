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
 *  - Request a new appointment (→ REQUESTED, counselor approves)
 *  - Cancel their own REQUESTED appointment (→ CANCELLED, before approval)
 *
 * Students CANNOT:
 *  - Create SCHEDULED appointments directly (counselor/admin does this
 *    when approving a REQUEST, or schedules ad-hoc meetings)
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
  REQUESTED: "Requested",
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
   *
   * Filter semantics:
   *  - upcoming:    SCHEDULED/CONFIRMED with future scheduledAt
   *  - past:        COMPLETED/NO_SHOW, or past SCHEDULED/CONFIRMED
   *  - cancelled:   CANCELLED
   *  - requested:   REQUESTED (pending counselor approval)
   *  - all (default): everything else, most recent first
   */
  async list(
    studentId: string,
    filter: "upcoming" | "past" | "cancelled" | "requested" | "all" = "all",
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
    } else if (filter === "requested") {
      where.status = "REQUESTED";
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

  /**
   * Request a new appointment → REQUESTED. The student proposes a
   * preferred time + purpose + meeting method; the counselor reviews
   * and either converts it to SCHEDULED (with possibly a different
   * time / location) or rejects it.
   *
   * The student's assignedEmployeeId becomes the appointment's
   * employeeId. If the student has no assigned counselor, the request
   * cannot be created — return a 409 so the client can surface a
   * helpful message ("please contact your branch").
   *
   * Guard against request flooding: a student cannot have more than
   * 3 outstanding REQUESTED appointments at once. This prevents an
   * accidental double-submit or a confused student from spamming
   * their counselor's queue.
   */
  async request(
    studentId: string,
    input: {
      preferredAt: Date;
      purpose: string;
      meetingMethod?: string | null;
      notes?: string | null;
    },
    userId?: string,
  ): Promise<AppointmentView> {
    // ── 1. Resolve the student + assigned counselor ──
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        assignedEmployeeId: true,
      },
    });
    if (!student) {
      throw new HttpError(404, "NOT_FOUND", "Student not found");
    }
    if (!student.assignedEmployeeId) {
      throw new HttpError(
        409,
        "CONFLICT",
        "You don't have an assigned counselor yet. Please contact your branch — they'll assign one and you can request appointments.",
      );
    }

    // ── 2. Verify the assigned employee exists + is active ──
    const counselor = await prisma.employee.findFirst({
      where: { id: student.assignedEmployeeId, deletedAt: null },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!counselor) {
      throw new HttpError(
        409,
        "CONFLICT",
        "Your assigned counselor is no longer available. Please contact your branch.",
      );
    }

    // ── 3. Flood guard — max 3 outstanding REQUESTED appointments ──
    const outstanding = await prisma.appointment.count({
      where: { studentId, status: "REQUESTED" },
    });
    if (outstanding >= 3) {
      throw new HttpError(
        409,
        "CONFLICT",
        "You already have 3 pending appointment requests. Please wait for your counselor to respond before requesting more.",
      );
    }

    // ── 4. Validate preferredAt is in the future ──
    // Allow up to 2 minutes in the past to account for clock drift +
    // form-submission latency. Anything older is rejected.
    const now = new Date();
    const twoMinsAgo = new Date(now.getTime() - 2 * 60 * 1000);
    if (input.preferredAt < twoMinsAgo) {
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "Preferred date must be in the future. Please pick an upcoming date.",
      );
    }

    // ── 5. Create the REQUESTED appointment ──
    const created = await prisma.appointment.create({
      data: {
        studentId,
        employeeId: counselor.id,
        scheduledAt: input.preferredAt,
        durationMins: 30, // default, counselor can adjust on approval
        purpose: input.purpose,
        meetingMethod: input.meetingMethod ?? null,
        status: "REQUESTED",
        notes: input.notes ?? null,
      },
      include: {
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // ── 6. Audit + notify counselor ──
    await auditLog.record({
      userId: userId ?? student.userId ?? undefined,
      action: "appointment.requested",
      entity: "Appointment",
      entityId: created.id,
      newValue: {
        status: "REQUESTED",
        scheduledAt: input.preferredAt,
        purpose: input.purpose,
        meetingMethod: input.meetingMethod ?? null,
      },
    });

    const counselorUserId = counselor.user?.id;
    if (counselorUserId) {
      await notifications.push({
        userId: counselorUserId,
        type: "APPOINTMENT_REQUESTED",
        title: "New appointment request",
        message: `${student.firstName} ${student.lastName} requested an appointment on ${input.preferredAt.toLocaleString()}. Purpose: ${input.purpose}.`,
        link: "/employee/students",
      });
    }

    return buildView(created as never);
  },
};
