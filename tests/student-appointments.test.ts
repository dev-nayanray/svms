import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockAppointmentFindMany = vi.fn();
const mockAppointmentFindFirst = vi.fn();
const mockAppointmentUpdate = vi.fn();
const mockStudentFindUnique = vi.fn();
const mockAuditRecord = vi.fn();
const mockNotificationsPush = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: (args: unknown) => mockStudentFindFirst(args),
      findUnique: (args: unknown) => mockStudentFindUnique(args),
    },
    appointment: {
      findMany: (args: unknown) => mockAppointmentFindMany(args),
      findFirst: (args: unknown) => mockAppointmentFindFirst(args),
      update: (args: unknown) => mockAppointmentUpdate(args),
    },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: { record: (input: unknown) => mockAuditRecord(input) },
}));
vi.mock("@/lib/services/notification", () => ({
  notifications: { push: (input: unknown) => mockNotificationsPush(input) },
}));

import { GET as GET_list } from "@/app/api/student/appointments/route";
import { GET as GET_detail } from "@/app/api/student/appointments/[id]/route";
import { POST as POST_confirm } from "@/app/api/student/appointments/[id]/confirm/route";
import { POST as POST_cancel } from "@/app/api/student/appointments/[id]/cancel/route";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const baseStudent = {
  id: "stu-1",
  userId: "user-1",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  email: "k@x.com",
  deletedAt: null,
};

const baseAppointment = {
  id: "appt-1",
  studentId: "stu-1",
  employeeId: "emp-1",
  scheduledAt: new Date("2026-09-20T10:00:00Z"),
  durationMins: 30,
  purpose: "Visa document review",
  location: "Office — Room 201",
  meetingMethod: "IN_PERSON",
  meetingLink: null,
  status: "SCHEDULED",
  notes: "Bring your passport and academic transcripts.",
  cancelReason: null,
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  createdAt: new Date("2026-09-12T08:00:00Z"),
  updatedAt: new Date("2026-09-12T08:00:00Z"),
  employee: {
    id: "emp-1",
    user: { id: "user-2", name: "Sarah Counselor" },
  },
};

const confirmedAppt = { ...baseAppointment, status: "CONFIRMED" };
const cancelledAppt = { ...baseAppointment, status: "CANCELLED", cancelReason: "Student unavailable", cancelledAt: new Date("2026-09-13T10:00:00Z") };
const completedAppt = { ...baseAppointment, status: "COMPLETED", completedAt: new Date("2026-09-20T10:30:00Z") };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers().setSystemTime(new Date("2026-09-15T12:00:00Z"));
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockStudentFindUnique.mockResolvedValue({ userId: "user-1", firstName: "Karim", lastName: "Ahmed" });
  mockAppointmentFindMany.mockResolvedValue([baseAppointment]);
  mockAppointmentFindFirst.mockResolvedValue(baseAppointment);
  mockAppointmentUpdate.mockResolvedValue({ ...baseAppointment, status: "CONFIRMED" });
  mockAuditRecord.mockResolvedValue(undefined);
  mockNotificationsPush.mockResolvedValue(undefined);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makeReq(url: string, method = "GET", body?: unknown): NextRequest {
  if (body !== undefined) {
    return new NextRequest(url, {
      method,
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }
  return new NextRequest(url, { method });
}

// ─────────────────────────────────────────────
// GET /api/student/appointments (list)
// ─────────────────────────────────────────────

describe("GET /api/student/appointments (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(makeReq("http://localhost/api/student/appointments"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(makeReq("http://localhost/api/student/appointments"));
    expect(res.status).toBe(403);
  });

  it("returns the caller's appointments (scoped by studentId)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(makeReq("http://localhost/api/student/appointments"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.appointments.length).toBe(1);
    expect(body.data.appointments[0].id).toBe("appt-1");
    expect(body.data.appointments[0].purpose).toBe("Visa document review");
    expect(body.data.appointments[0].counselorName).toBe("Sarah Counselor");
    expect(body.data.appointments[0].statusLabel).toBe("Scheduled");
  });

  it("scopes findMany by studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/appointments"));
    expect(mockAppointmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "stu-1" }),
      }),
    );
  });

  it("supports ?filter=upcoming (SCHEDULED/CONFIRMED + future)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/appointments?filter=upcoming"));
    const whereArg = mockAppointmentFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.status).toEqual({ in: ["SCHEDULED", "CONFIRMED"] });
    expect(whereArg.scheduledAt).toBeDefined();
  });

  it("supports ?filter=cancelled", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/appointments?filter=cancelled"));
    const whereArg = mockAppointmentFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.status).toBe("CANCELLED");
  });

  it("never exposes internal fields (employeeId, deletedAt)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(makeReq("http://localhost/api/student/appointments"));
    const body = await res.json();
    for (const a of body.data.appointments) {
      expect("employeeId" in a).toBe(false);
      expect("studentId" in a).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────
// GET /api/student/appointments/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/appointments/[id] (detail)", () => {
  async function callDetail(id: string) {
    return GET_detail(
      makeReq(`http://localhost/api/student/appointments/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDetail("appt-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the appointment doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentFindFirst.mockResolvedValue(null);
    const res = await callDetail("foreign-appt-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns the full appointment detail", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("appt-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.appointment.id).toBe("appt-1");
    expect(body.data.appointment.purpose).toBe("Visa document review");
    expect(body.data.appointment.counselorName).toBe("Sarah Counselor");
    expect(body.data.appointment.statusLabel).toBe("Scheduled");
    expect(body.data.appointment.meetingMethod).toBe("IN_PERSON");
  });

  it("scopes findFirst by studentId (ownership check)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("appt-1");
    expect(mockAppointmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "appt-1", studentId: "stu-1" }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// POST /api/student/appointments/[id]/confirm
// ─────────────────────────────────────────────

describe("POST /api/student/appointments/[id]/confirm", () => {
  async function callConfirm(id: string) {
    return POST_confirm(
      makeReq(`http://localhost/api/student/appointments/${id}/confirm`, "POST"),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callConfirm("appt-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the appointment doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentFindFirst.mockResolvedValue(null);
    const res = await callConfirm("foreign-id");
    expect(res.status).toBe(404);
  });

  it("confirms a SCHEDULED appointment → CONFIRMED", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentUpdate.mockResolvedValue({ ...baseAppointment, status: "CONFIRMED" });
    const res = await callConfirm("appt-1");
    expect(res.status).toBe(200);
    expect(mockAppointmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: expect.objectContaining({ status: "CONFIRMED" }),
      }),
    );
  });

  it("returns 409 when confirming a non-SCHEDULED appointment", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentFindFirst.mockResolvedValue(confirmedAppt);
    const res = await callConfirm("appt-1");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("audit-logs the confirmation", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callConfirm("appt-1");
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "appointment.confirmed",
        entity: "Appointment",
        entityId: "appt-1",
        oldValue: { status: "SCHEDULED" },
        newValue: { status: "CONFIRMED" },
      }),
    );
  });

  it("notifies the counselor when the student confirms", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callConfirm("appt-1");
    expect(mockNotificationsPush).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        type: "APPOINTMENT_CONFIRMED",
      }),
    );
  });
});

// ─────────────────────────────────────────────
// POST /api/student/appointments/[id]/cancel
// ─────────────────────────────────────────────

describe("POST /api/student/appointments/[id]/cancel", () => {
  async function callCancel(id: string, body?: unknown) {
    return POST_cancel(
      makeReq(`http://localhost/api/student/appointments/${id}/cancel`, "POST", body),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callCancel("appt-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the appointment doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentFindFirst.mockResolvedValue(null);
    const res = await callCancel("foreign-id");
    expect(res.status).toBe(404);
  });

  it("cancels a SCHEDULED appointment → CANCELLED", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentUpdate.mockResolvedValue({ ...baseAppointment, status: "CANCELLED", cancelReason: "Student unavailable" });
    const res = await callCancel("appt-1", { cancelReason: "Student unavailable" });
    expect(res.status).toBe(200);
    expect(mockAppointmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelledAt: expect.any(Date),
          cancelReason: "Student unavailable",
        }),
      }),
    );
  });

  it("cancels a CONFIRMED appointment → CANCELLED", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentFindFirst.mockResolvedValue(confirmedAppt);
    mockAppointmentUpdate.mockResolvedValue({ ...confirmedAppt, status: "CANCELLED" });
    const res = await callCancel("appt-1");
    expect(res.status).toBe(200);
  });

  it("returns 409 when cancelling a COMPLETED appointment", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentFindFirst.mockResolvedValue(completedAppt);
    const res = await callCancel("appt-1");
    expect(res.status).toBe(409);
  });

  it("returns 409 when cancelling a CANCELLED appointment", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockAppointmentFindFirst.mockResolvedValue(cancelledAppt);
    const res = await callCancel("appt-1");
    expect(res.status).toBe(409);
  });

  it("audit-logs the cancellation", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callCancel("appt-1", { cancelReason: "Conflict" });
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "appointment.cancelled",
        entity: "Appointment",
        entityId: "appt-1",
        newValue: expect.objectContaining({ status: "CANCELLED", cancelReason: "Conflict" }),
      }),
    );
  });

  it("notifies the counselor when the student cancels", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callCancel("appt-1", { cancelReason: "Student unavailable" });
    expect(mockNotificationsPush).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        type: "APPOINTMENT_CANCELLED",
      }),
    );
  });

  it("accepts cancel without a reason (optional)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callCancel("appt-1", {});
    expect(res.status).toBe(200);
  });
});
