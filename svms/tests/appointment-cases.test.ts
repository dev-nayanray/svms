import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  appointment: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
  student: { findFirst: vi.fn(), findUnique: vi.fn() },
  notification: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listAppointments,
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  addNote,
  APPOINTMENT_TYPES,
  APPOINTMENT_VIEWS,
  TYPE_LABELS,
} from "@/lib/services/appointment-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

describe("appointment constants", () => {
  it("has 7 appointment types", () => {
    expect(APPOINTMENT_TYPES).toHaveLength(7);
    expect(APPOINTMENT_TYPES).toContain("COUNSELING");
    expect(APPOINTMENT_TYPES).toContain("BIOMETRICS_PREPARATION");
    expect(APPOINTMENT_TYPES).toContain("INTERVIEW_PREPARATION");
  });

  it("has 5 views", () => {
    expect(APPOINTMENT_VIEWS).toHaveLength(5);
    expect(APPOINTMENT_VIEWS).toContain("upcoming");
    expect(APPOINTMENT_VIEWS).toContain("today");
    expect(APPOINTMENT_VIEWS).toContain("past");
    expect(APPOINTMENT_VIEWS).toContain("cancelled");
    expect(APPOINTMENT_VIEWS).toContain("all");
  });

  it("has human-readable type labels", () => {
    expect(TYPE_LABELS.COUNSELING).toBe("Counseling");
    expect(TYPE_LABELS.BIOMETRICS_PREPARATION).toBe("Biometrics Preparation");
  });
});

// ─────────────────────────────────────────────
// IDOR closure
// ─────────────────────────────────────────────

describe("appointment IDOR closure", () => {
  it("EMPLOYEE scope embeds student.assignedEmployeeId filter", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    await listAppointments(EMPLOYEE_SCOPE, {});
    const call = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(call.where.student).toEqual({ assignedEmployeeId: "emp-1" });
  });

  it("ADMIN scope is empty — sees all appointments", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    await listAppointments(ADMIN_SCOPE, {});
    const call = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(call.where.student).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// List — views
// ─────────────────────────────────────────────

describe("listAppointments — views", () => {
  it("upcoming view filters to SCHEDULED + future", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    await listAppointments(EMPLOYEE_SCOPE, { view: "upcoming" });
    const call = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("SCHEDULED");
    expect(call.where.scheduledAt.gt).toBeInstanceOf(Date);
  });

  it("today view filters to SCHEDULED + today's date range", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    await listAppointments(EMPLOYEE_SCOPE, { view: "today" });
    const call = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("SCHEDULED");
    expect(call.where.scheduledAt.gte).toBeInstanceOf(Date);
    expect(call.where.scheduledAt.lte).toBeInstanceOf(Date);
  });

  it("past view filters to SCHEDULED/COMPLETED + before start of today", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    await listAppointments(EMPLOYEE_SCOPE, { view: "past" });
    const call = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ["SCHEDULED", "COMPLETED"] });
    expect(call.where.scheduledAt.lt).toBeInstanceOf(Date);
  });

  it("cancelled view filters to status=CANCELLED", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    await listAppointments(EMPLOYEE_SCOPE, { view: "cancelled" });
    const call = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("CANCELLED");
  });

  it("all view has no status filter", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    await listAppointments(EMPLOYEE_SCOPE, { view: "all" });
    const call = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(call.where.status).toBeUndefined();
  });

  it("returns counts for every view (for tab badges)", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(0);
    const result = await listAppointments(EMPLOYEE_SCOPE, {});
    expect(result.counts).toEqual(expect.objectContaining({
      upcoming: 0, today: 0, past: 0, cancelled: 0, all: 0,
    }));
  });
});

// ─────────────────────────────────────────────
// Create — validation + duplicate + notification
// ─────────────────────────────────────────────

describe("createAppointment", () => {
  it("creates an appointment with default values", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", userId: "u-stu", firstName: "K", lastName: "A" });
    prismaMock.appointment.findFirst.mockResolvedValue(null); // no duplicate
    prismaMock.appointment.create.mockResolvedValue({ id: "appt-1" });
    const result = await createAppointment(EMPLOYEE_SCOPE, {
      studentId: "s1", type: "COUNSELING", title: "Initial counseling",
      scheduledAt: new Date("2026-10-01T10:00:00Z"),
    }, { id: "u-emp" });
    expect(result.id).toBe("appt-1");
    expect(prismaMock.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: "s1", type: "COUNSELING", title: "Initial counseling",
        durationMinutes: 30, status: "SCHEDULED",
      }),
    }));
  });

  it("rejects an invalid appointment type with 400", async () => {
    await expect(createAppointment(EMPLOYEE_SCOPE, {
      studentId: "s1", type: "INVALID", title: "X", scheduledAt: new Date(),
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("blocks creating appointments for foreign students (IDOR)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null); // student not found for this employee
    await expect(createAppointment(EMPLOYEE_SCOPE, {
      studentId: "stu-foreign", type: "COUNSELING", title: "X", scheduledAt: new Date(),
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("blocks duplicate bookings (same student, same time, SCHEDULED)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", userId: "u-stu", firstName: "K", lastName: "A" });
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "existing" }); // duplicate found
    await expect(createAppointment(EMPLOYEE_SCOPE, {
      studentId: "s1", type: "COUNSELING", title: "X", scheduledAt: new Date("2026-10-01T10:00:00Z"),
    }, { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("emits APPOINTMENT_CREATED notification to the student", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", userId: "u-stu", firstName: "K", lastName: "A" });
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    prismaMock.appointment.create.mockResolvedValue({ id: "appt-1" });
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu", firstName: "K", lastName: "A" });
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await createAppointment(EMPLOYEE_SCOPE, {
      studentId: "s1", type: "COUNSELING", title: "Initial", scheduledAt: new Date(),
    }, { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-stu", type: "APPOINTMENT_CREATED" }),
    }));
  });
});

// ─────────────────────────────────────────────
// Reschedule
// ─────────────────────────────────────────────

describe("rescheduleAppointment", () => {
  it("reschedules and sets status to RESCHEDULED", async () => {
    prismaMock.appointment.findFirst
      .mockResolvedValueOnce({ id: "a1", status: "SCHEDULED", scheduledAt: new Date("2026-10-01"), studentId: "s1", title: "Counseling" }) // initial lookup
      .mockResolvedValueOnce(null); // no conflict at new time
    prismaMock.appointment.update.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    await rescheduleAppointment(EMPLOYEE_SCOPE, "a1", new Date("2026-10-15T10:00:00Z"), { id: "u-emp" });
    expect(prismaMock.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scheduledAt: new Date("2026-10-15T10:00:00Z"), status: "RESCHEDULED" }),
    }));
  });

  it("blocks rescheduling a cancelled appointment (409)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "CANCELLED", scheduledAt: new Date(), studentId: "s1", title: "X" });
    await expect(rescheduleAppointment(EMPLOYEE_SCOPE, "a1", new Date(), { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("blocks rescheduling a completed appointment (409)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "COMPLETED", scheduledAt: new Date(), studentId: "s1", title: "X" });
    await expect(rescheduleAppointment(EMPLOYEE_SCOPE, "a1", new Date(), { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("blocks rescheduling to a conflicting time (duplicate)", async () => {
    prismaMock.appointment.findFirst
      .mockResolvedValueOnce({ id: "a1", status: "SCHEDULED", scheduledAt: new Date(), studentId: "s1", title: "X" })
      .mockResolvedValueOnce({ id: "a2" }); // conflict
    await expect(rescheduleAppointment(EMPLOYEE_SCOPE, "a1", new Date("2026-10-15"), { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("emits APPOINTMENT_RESCHEDULED notification", async () => {
    prismaMock.appointment.findFirst
      .mockResolvedValueOnce({ id: "a1", status: "SCHEDULED", scheduledAt: new Date(), studentId: "s1", title: "X" })
      .mockResolvedValueOnce(null);
    prismaMock.appointment.update.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await rescheduleAppointment(EMPLOYEE_SCOPE, "a1", new Date("2026-10-15"), { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-stu", type: "APPOINTMENT_RESCHEDULED" }),
    }));
  });

  it("IDOR: foreign appointment returns 404", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    await expect(rescheduleAppointment(EMPLOYEE_SCOPE, "a-foreign", new Date(), { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────

describe("cancelAppointment", () => {
  it("cancels a SCHEDULED appointment", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "SCHEDULED", studentId: "s1", title: "X" });
    prismaMock.appointment.update.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    await cancelAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" });
    expect(prismaMock.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" }),
    }));
  });

  it("is a no-op when already CANCELLED", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "CANCELLED", studentId: "s1", title: "X" });
    await cancelAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" });
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it("blocks cancelling a COMPLETED appointment (409)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "COMPLETED", studentId: "s1", title: "X" });
    await expect(cancelAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("emits APPOINTMENT_CANCELLED notification", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "SCHEDULED", studentId: "s1", title: "X" });
    prismaMock.appointment.update.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await cancelAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-stu", type: "APPOINTMENT_CANCELLED" }),
    }));
  });
});

// ─────────────────────────────────────────────
// Complete + confirm + note
// ─────────────────────────────────────────────

describe("completeAppointment", () => {
  it("marks SCHEDULED as COMPLETED", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "SCHEDULED" });
    prismaMock.appointment.update.mockResolvedValue({});
    await completeAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" });
    expect(prismaMock.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "COMPLETED" }),
    }));
  });

  it("is a no-op when already COMPLETED", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "COMPLETED" });
    await completeAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" });
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it("blocks completing a CANCELLED appointment (409)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "CANCELLED" });
    await expect(completeAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });
});

describe("confirmAppointment", () => {
  it("sets RESCHEDULED back to SCHEDULED and notifies", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "RESCHEDULED", studentId: "s1", title: "X" });
    prismaMock.appointment.update.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await confirmAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" });
    expect(prismaMock.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SCHEDULED" }),
    }));
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "APPOINTMENT_CONFIRMED" }),
    }));
  });

  it("blocks confirming a cancelled appointment (409)", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", status: "CANCELLED", studentId: "s1", title: "X" });
    await expect(confirmAppointment(EMPLOYEE_SCOPE, "a1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });
});

describe("addNote", () => {
  it("appends a note to existing notes", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", notes: "Existing note" });
    prismaMock.appointment.update.mockResolvedValue({});
    await addNote(EMPLOYEE_SCOPE, "a1", "New note", { id: "u-emp" });
    const call = prismaMock.appointment.update.mock.calls[0][0];
    expect(call.data.notes).toContain("Existing note");
    expect(call.data.notes).toContain("New note");
  });

  it("sets note when none exists", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "a1", notes: null });
    prismaMock.appointment.update.mockResolvedValue({});
    await addNote(EMPLOYEE_SCOPE, "a1", "First note", { id: "u-emp" });
    expect(prismaMock.appointment.update.mock.calls[0][0].data.notes).toBe("First note");
  });

  it("blocks empty notes (422)", async () => {
    await expect(addNote(EMPLOYEE_SCOPE, "a1", "", { id: "u-emp" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    await expect(addNote(EMPLOYEE_SCOPE, "a1", "   ", { id: "u-emp" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("IDOR: foreign appointment returns 404", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    await expect(addNote(EMPLOYEE_SCOPE, "a-foreign", "note", { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listAppointments lets prisma errors bubble", async () => {
    prismaMock.appointment.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.appointment.count.mockResolvedValue(0);
    await expect(listAppointments(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });
});
