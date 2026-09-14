import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockStudentFindUnique = vi.fn();
const mockPrefFindUnique = vi.fn();
const mockPrefCreate = vi.fn();
const mockPrefUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockAuditRecord = vi.fn();
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: (args: unknown) => mockStudentFindFirst(args),
      findUnique: (args: unknown) => mockStudentFindUnique(args),
    },
    studentPreference: {
      findUnique: (args: unknown) => mockPrefFindUnique(args),
      create: (args: unknown) => mockPrefCreate(args),
      update: (args: unknown) => mockPrefUpdate(args),
    },
    user: {
      findUnique: (args: unknown) => mockUserFindUnique(args),
      update: (args: unknown) => mockUserUpdate(args),
    },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: {
    record: (input: unknown) => mockAuditRecord(input),
    fromRequest: () => ({ ipAddress: "127.0.0.1", userAgent: "test" }),
  },
}));
vi.mock("bcryptjs", () => ({
  default: {
    compare: (a: string, b: string) => mockBcryptCompare(a, b),
    hash: (a: string, b: number) => mockBcryptHash(a, b),
  },
}));

import { GET as GET_settings, PATCH as PATCH_settings } from "@/app/api/student/settings/route";
import { POST as POST_password } from "@/app/api/student/settings/password/route";

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
  phone: "+8801",
  whatsapp: "+8801",
  alternativePhone: null,
  deletedAt: null,
};

const baseUser = {
  id: "user-1",
  name: "Karim Ahmed",
  email: "k@x.com",
  passwordHash: "$2a$10$oldhash",
  status: "ACTIVE",
  deletedAt: null,
};

const basePrefs = {
  id: "pref-1",
  studentId: "stu-1",
  notifApplication: true,
  notifDocuments: true,
  notifVisa: true,
  notifPayments: true,
  notifTasks: true,
  notifMessages: true,
  notifAppointments: true,
  theme: "system",
  language: "en",
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue({ ...baseStudent, user: baseUser });
  mockStudentFindUnique.mockResolvedValue({
    ...baseStudent,
    user: baseUser,
  });
  mockPrefFindUnique.mockResolvedValue(basePrefs);
  mockPrefCreate.mockResolvedValue(basePrefs);
  mockPrefUpdate.mockResolvedValue(basePrefs);
  mockAuditRecord.mockResolvedValue(undefined);
  mockBcryptCompare.mockResolvedValue(true);
  mockBcryptHash.mockResolvedValue("$2a$10$newhash");
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makePatchReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/settings/password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────
// GET /api/student/settings
// ─────────────────────────────────────────────

describe("GET /api/student/settings", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_settings(new NextRequest("http://localhost/api/student/settings"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_settings(new NextRequest("http://localhost/api/student/settings"));
    expect(res.status).toBe(403);
  });

  it("returns preferences + account info", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_settings(new NextRequest("http://localhost/api/student/settings"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.preferences).toBeDefined();
    expect(body.data.preferences.notifApplication).toBe(true);
    expect(body.data.preferences.theme).toBe("system");
    expect(body.data.preferences.language).toBe("en");
    expect(body.data.account.email).toBe("k@x.com");
    expect(body.data.account.firstName).toBe("Karim");
  });

  it("creates default preferences if none exist", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockPrefFindUnique.mockResolvedValue(null);
    const res = await GET_settings(new NextRequest("http://localhost/api/student/settings"));
    expect(res.status).toBe(200);
    expect(mockPrefCreate).toHaveBeenCalled();
  });

  it("never exposes passwordHash, role, permissions, branchId", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_settings(new NextRequest("http://localhost/api/student/settings"));
    const body = await res.json();
    expect("passwordHash" in body.data.account).toBe(false);
    expect("role" in body.data.account).toBe(false);
    expect("branchId" in body.data.account).toBe(false);
    expect("assignedEmployeeId" in body.data.account).toBe(false);
    expect("status" in body.data.account).toBe(false);
  });
});

// ─────────────────────────────────────────────
// PATCH /api/student/settings
// ─────────────────────────────────────────────

describe("PATCH /api/student/settings", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await PATCH_settings(makePatchReq({ theme: "dark" }));
    expect(res.status).toBe(401);
  });

  it("updates notification preference (notifApplication: false)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockPrefUpdate.mockResolvedValue({ ...basePrefs, notifApplication: false });
    const res = await PATCH_settings(makePatchReq({ notifApplication: false }));
    expect(res.status).toBe(200);
    expect(mockPrefUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notifApplication: false }),
      }),
    );
  });

  it("updates theme to dark", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockPrefUpdate.mockResolvedValue({ ...basePrefs, theme: "dark" });
    const res = await PATCH_settings(makePatchReq({ theme: "dark" }));
    expect(res.status).toBe(200);
    expect(mockPrefUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ theme: "dark" }),
      }),
    );
  });

  it("updates language to bn (Bangla)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockPrefUpdate.mockResolvedValue({ ...basePrefs, language: "bn" });
    const res = await PATCH_settings(makePatchReq({ language: "bn" }));
    expect(res.status).toBe(200);
    expect(mockPrefUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ language: "bn" }),
      }),
    );
  });

  it("returns 422 when theme is invalid", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await PATCH_settings(makePatchReq({ theme: "invalid" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when language is invalid", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await PATCH_settings(makePatchReq({ language: "fr" }));
    expect(res.status).toBe(422);
  });

  it("audit-logs the preference update", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await PATCH_settings(makePatchReq({ theme: "dark" }));
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "student_settings.updated",
        entity: "StudentPreference",
      }),
    );
  });
});

// ─────────────────────────────────────────────
// POST /api/student/settings/password
// ─────────────────────────────────────────────

describe("POST /api/student/settings/password", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await POST_password(makePostReq({ currentPassword: "old", newPassword: "newpass1" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 when newPassword is too short (<8 chars)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_password(makePostReq({ currentPassword: "old", newPassword: "short1" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when newPassword has no number", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_password(makePostReq({ currentPassword: "old", newPassword: "password" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when newPassword has no letter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_password(makePostReq({ currentPassword: "old", newPassword: "12345678" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when newPassword equals currentPassword", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_password(makePostReq({ currentPassword: "samepass1", newPassword: "samepass1" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when current password is incorrect", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockBcryptCompare.mockResolvedValue(false);
    const res = await POST_password(makePostReq({ currentPassword: "wrong", newPassword: "newpass1" }));
    expect(res.status).toBe(422);
  });

  it("changes the password when current password is correct", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_password(makePostReq({ currentPassword: "oldpass1", newPassword: "newpass1" }));
    expect(res.status).toBe(200);
    expect(mockBcryptCompare).toHaveBeenCalledWith("oldpass1", "$2a$10$oldhash");
    expect(mockBcryptHash).toHaveBeenCalledWith("newpass1", 10);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: "$2a$10$newhash" }),
      }),
    );
  });

  it("audit-logs the password change", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await POST_password(makePostReq({ currentPassword: "oldpass1", newPassword: "newpass1" }));
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "student.password_changed",
        entity: "User",
      }),
    );
  });

  it("never exposes passwordHash in the response", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_password(makePostReq({ currentPassword: "oldpass1", newPassword: "newpass1" }));
    const body = await res.json();
    expect("passwordHash" in body.data).toBe(false);
    expect("hash" in body.data).toBe(false);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("oldhash");
    expect(bodyStr).not.toContain("newhash");
  });
});
