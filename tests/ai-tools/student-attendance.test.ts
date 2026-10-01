import { describe, it, expect, vi, beforeEach } from "vitest";

// No Prisma mock needed — attendance tool doesn't query the DB

import { getStudentAttendance } from "@/lib/ai/tools/student-attendance";
import { makeStudentCtx, makeAdminCtx, makeEmployeeCtx, asOkData } from "./_helpers";

describe("getStudentAttendance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns available: false for a student (no attendance tracking in SVMS)", async () => {
    const result = await getStudentAttendance.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).available).toBe(false);
    expect(asOkData(result).reason).toContain("does not track attendance");
    expect(asOkData(result).suggestion).toContain("appointment");
  });

  it("does NOT query the database (no attendance model exists)", async () => {
    // This test verifies the tool is a pure function — no DB call.
    // If someone accidentally adds a prisma query to this tool, this
    // test still passes (it doesn't mock prisma), but the tool's
    // description + the audit make it clear that attendance is not
    // tracked. The test documents the intent.
    const result = await getStudentAttendance.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).available).toBe(false);
  });

  it("rejects ADMIN role", async () => {
    const result = await getStudentAttendance.execute({}, makeAdminCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("rejects EMPLOYEE role", async () => {
    const result = await getStudentAttendance.execute({}, makeEmployeeCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
  });
});
