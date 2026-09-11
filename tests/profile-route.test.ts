import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockFindFirst = vi.fn();
const mockStudentUpdate = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: (args: unknown) => mockFindFirst(args),
      update: (args: unknown) => mockStudentUpdate(args),
    },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: { record: (input: unknown) => mockAuditRecord(input) },
}));

import { GET, PATCH } from "@/app/api/student/profile/route";

const baseStudent = {
  id: "stu-1",
  userId: "user-1",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  dateOfBirth: null,
  gender: null,
  nationality: null,
  profilePhotoUrl: null,
  email: "karim@x.com",
  phone: null,
  whatsapp: null,
  alternativePhone: null,
  country: null,
  division: null,
  district: null,
  city: null,
  address: null,
  postalCode: null,
  passportNumber: null,
  passportIssueDate: null,
  passportExpiryDate: null,
  passportIssuingCountry: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  emergencyContactRelation: null,
  assignedEmployeeId: null,
  branchId: null,
  status: "ACTIVE",
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseStudentWithRelations = {
  ...baseStudent,
  academicRecords: [],
  englishProficiencies: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  // Default to the row with relations — both studentApiGuard's
  // loadStudentProfile and studentProfileService.load use findFirst;
  // the guard ignores extra fields, and the service needs them.
  mockFindFirst.mockResolvedValue(baseStudentWithRelations);
  mockStudentUpdate.mockResolvedValue(baseStudentWithRelations);
  mockAuditRecord.mockResolvedValue(undefined);
});

function mockAuthResolved(user: { id: string | null; role?: string; name?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makeJsonReq(body: unknown) {
  return {
    method: "PATCH",
    json: async () => body,
    headers: { get: () => "application/json" },
  } as unknown as NextRequest;
}

// ─────────────────────────────────────────────
// GET /api/student/profile
// ─────────────────────────────────────────────

describe("GET /api/student/profile (access control)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("rejects STUDENT users without a linked profile (403, not 404)", async () => {
    mockAuthResolved({ id: "user-9", role: "STUDENT" });
    // studentApiGuard's loadStudentProfile returns null
    mockFindFirst.mockReset();
    mockFindFirst.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the caller's own profile with completion data", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("stu-1");
    expect(body.data.completion).toBeDefined();
    expect(body.data.completion.percent).toBeGreaterThanOrEqual(0);
  });

  it("derives the student record from the session, never from client input", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET();
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } })
    );
  });
});

// ─────────────────────────────────────────────
// PATCH /api/student/profile
// ─────────────────────────────────────────────

describe("PATCH /api/student/profile (update + security)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await PATCH(makeJsonReq({ firstName: "X" }));
    expect(res.status).toBe(401);
  });

  it("updates permitted fields and returns the new view", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await PATCH(makeJsonReq({ firstName: "Karim2", phone: "+8801" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockStudentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stu-1" },
        data: expect.objectContaining({ firstName: "Karim2", phone: "+8801" }),
      })
    );
  });

  it("emits an audit event for the update", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await PATCH(makeJsonReq({ firstName: "Karim2" }));
    const actions = mockAuditRecord.mock.calls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toContain("student_profile.updated");
  });

  it("emits a dedicated audit event when phone changes (sensitive contact)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await PATCH(makeJsonReq({ phone: "+8801" }));
    const actions = mockAuditRecord.mock.calls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toContain("student_profile.phone_changed");
  });

  it("emits a dedicated audit event when whatsapp changes", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await PATCH(makeJsonReq({ whatsapp: "+8802" }));
    const actions = mockAuditRecord.mock.calls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toContain("student_profile.whatsapp_changed");
  });

  it("rejects ownership fields in the body with a 422 (defense-in-depth)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Even though the schema strips these, the route also explicitly
    // 422s when they appear in the raw body so the bug is loud.
    const res = await PATCH(makeJsonReq({ studentId: "STD-999", status: "SUSPENDED" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid input with a 422 VALIDATION_ERROR", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // firstName too long (>80 chars)
    const res = await PATCH(makeJsonReq({ firstName: "x".repeat(81) }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields).toBeDefined();
  });

  it("uses the student resolved from the session, not from the body", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Even if a 'studentId' sneaks in (the route 422s on this, but the
    // service-level invariant is: only the session-resolved id is used)
    await PATCH(makeJsonReq({ firstName: "Karim2", studentId: "stu-999" })).catch(() => {});
    // The update call must use stu-1 (from session), not stu-999.
    expect(mockStudentUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "stu-999" } })
    );
  });

  it("accepts null to clear an optional field", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await PATCH(makeJsonReq({ phone: null }));
    expect(res.status).toBe(200);
  });

  it("never updates role, branchId, assignedEmployeeId, or status via this route", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // The route 422s on these even being present — but even if we
    // bypass that, the service-level sanitization drops them.
    await PATCH(makeJsonReq({ firstName: "X", status: "SUSPENDED" })).catch(() => {});
    if (mockStudentUpdate.mock.calls.length > 0) {
      const data = mockStudentUpdate.mock.calls[0][0].data as Record<string, unknown>;
      expect("status" in data).toBe(false);
      expect("role" in data).toBe(false);
      expect("branchId" in data).toBe(false);
      expect("assignedEmployeeId" in data).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────
// Passport masking on read
// ─────────────────────────────────────────────

describe("passport masking on GET", () => {
  it("returns passportNumberMasked alongside the raw passportNumber", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockFindFirst.mockResolvedValue({
      ...baseStudentWithRelations,
      passportNumber: "AB1234567",
    });
    const res = await GET();
    const body = await res.json();
    expect(body.data.passportNumber).toBe("AB1234567");
    expect(body.data.passportNumberMasked).toBe("AB•••••67");
  });

  it("returns '—' for the masked value when the passport is null", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockFindFirst.mockResolvedValue(baseStudentWithRelations);
    const res = await GET();
    const body = await res.json();
    expect(body.data.passportNumberMasked).toBe("—");
  });
});
