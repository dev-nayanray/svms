import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

const mockStudentFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (...args: unknown[]) => mockStudentFindFirst(...args) },
  },
}));

import { getStudentProfile } from "@/lib/ai/tools/student-profile";
import { makeStudentCtx, makeAdminCtx, makeEmployeeCtx, fixtureStudent, asOkData } from "./_helpers";

// ── Tests ────────────────────────────────────────────────────────

describe("getStudentProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Authorized access (STUDENT role) ───────────────────────────

  it("returns the student's profile for an authenticated student", async () => {
    mockStudentFindFirst.mockResolvedValue({
      ...fixtureStudent,
      user: { email: "karim@example.com", name: "Karim Ahmed" },
      employee: {
        title: "Senior Counselor",
        user: { name: "Sarah Johnson", email: "sarah@euroscope.com" },
      },
      branch: { name: "Dhaka Main", code: "DHK-01" },
    });

    const result = await getStudentProfile.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);

    // Verify the correct fields are returned
    expect(asOkData(result).firstName).toBe("Karim");
    expect(asOkData(result).lastName).toBe("Ahmed");
    expect(asOkData(result).email).toBe("karim@example.com");
    expect(asOkData(result).studentId).toBe("STD-2026-000001");
    expect(asOkData(result).status).toBe("ACTIVE");
    expect(asOkData(result).assignedCounselor).toEqual({
      name: "Sarah Johnson",
      title: "Senior Counselor",
      email: "sarah@euroscope.com",
    });
    expect(asOkData(result).branch).toEqual({ name: "Dhaka Main", code: "DHK-01" });
  });

  it("queries with the authenticated studentId from context (not from args)", async () => {
    mockStudentFindFirst.mockResolvedValue({
      ...fixtureStudent,
      user: { email: "k@x.com", name: "Karim" },
      employee: null,
      branch: null,
    });

    await getStudentProfile.execute({}, makeStudentCtx({ studentId: "stu-from-session" }));

    // The query must use ctx.studentId, not anything from args
    expect(mockStudentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "stu-from-session",
          deletedAt: null,
        }),
      }),
    );
  });

  it("filters out soft-deleted students", async () => {
    mockStudentFindFirst.mockResolvedValue({
      ...fixtureStudent,
      user: { email: "k@x.com", name: "Karim" },
      employee: null,
      branch: null,
    });

    await getStudentProfile.execute({}, makeStudentCtx());

    expect(mockStudentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it("returns NOT_FOUND when no student exists for the session studentId", async () => {
    mockStudentFindFirst.mockResolvedValue(null);

    const result = await getStudentProfile.execute({}, makeStudentCtx({ studentId: "nonexistent" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("Student profile");
  });

  it("handles missing counselor gracefully", async () => {
    mockStudentFindFirst.mockResolvedValue({
      ...fixtureStudent,
      user: { email: "k@x.com", name: "Karim" },
      employee: null, // No counselor assigned
      branch: null,
    });

    const result = await getStudentProfile.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).assignedCounselor).toBeNull();
    expect(asOkData(result).branch).toBeNull();
  });

  it("wraps database errors in INTERNAL error", async () => {
    mockStudentFindFirst.mockRejectedValue(new Error("Connection failed"));

    const result = await getStudentProfile.execute({}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
    expect(result.error.message).toContain("getStudentProfile");
    // Error message must NOT include the raw DB error (no connection strings leaked)
    expect(result.error.message).not.toContain("Connection failed");
  });

  // ── Unauthorized access (ADMIN / EMPLOYEE roles) ───────────────

  it("rejects ADMIN role with FORBIDDEN", async () => {
    const result = await getStudentProfile.execute({}, makeAdminCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("only available to students");
    // Should not have queried the database
    expect(mockStudentFindFirst).not.toHaveBeenCalled();
  });

  it("rejects EMPLOYEE role with FORBIDDEN", async () => {
    const result = await getStudentProfile.execute({}, makeEmployeeCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockStudentFindFirst).not.toHaveBeenCalled();
  });
});
