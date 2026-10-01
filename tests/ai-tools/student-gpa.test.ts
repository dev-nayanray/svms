import { describe, it, expect, vi, beforeEach } from "vitest";

const mockArFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    academicRecord: { findMany: (...a: unknown[]) => mockArFindMany(...a) },
  },
}));

import { getStudentGPA } from "@/lib/ai/tools/student-gpa";
import { makeStudentCtx, makeAdminCtx, asOkData } from "./_helpers";

describe("getStudentGPA", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts GPA from '3.8/4.0' format", async () => {
    mockArFindMany.mockResolvedValue([
      { level: "BACHELOR", institution: "DU", result: "3.8/4.0", passingYear: 2024 },
    ]);

    const result = await getStudentGPA.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).available).toBe(true);
    expect(asOkData(result).gpa).toBe(3.8);
    expect(asOkData(result).scale).toBe(4.0);
    expect(asOkData(result).level).toBe("BACHELOR");
  });

  it("extracts GPA from 'GPA: 3.5' labeled format", async () => {
    mockArFindMany.mockResolvedValue([
      { level: "BACHELOR", institution: "DU", result: "GPA: 3.5", passingYear: 2024 },
    ]);

    const result = await getStudentGPA.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).available).toBe(true);
    expect(asOkData(result).gpa).toBe(3.5);
    expect(asOkData(result).scale).toBeNull();
  });

  it("extracts bare GPA in 0-4 range", async () => {
    mockArFindMany.mockResolvedValue([
      { level: "HSC", institution: "Dhaka College", result: "3.2", passingYear: 2020 },
    ]);

    const result = await getStudentGPA.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).available).toBe(true);
    expect(asOkData(result).gpa).toBe(3.2);
  });

  it("returns available: false for percentage format (not GPA)", async () => {
    mockArFindMany.mockResolvedValue([
      { level: "SSC", institution: "School", result: "85%", passingYear: 2018 },
    ]);

    const result = await getStudentGPA.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).available).toBe(false);
    expect(asOkData(result).gpa).toBeNull();
  });

  it("returns available: false for letter grade format", async () => {
    mockArFindMany.mockResolvedValue([
      { level: "SSC", institution: "School", result: "A+", passingYear: 2018 },
    ]);

    const result = await getStudentGPA.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).available).toBe(false);
  });

  it("returns available: false when no academic records exist", async () => {
    mockArFindMany.mockResolvedValue([]);

    const result = await getStudentGPA.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).available).toBe(false);
    expect(asOkData(result).reason).toContain("No academic records");
  });

  it("queries with the authenticated studentId", async () => {
    mockArFindMany.mockResolvedValue([]);

    await getStudentGPA.execute({}, makeStudentCtx({ studentId: "stu-secure" }));

    expect(mockArFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "stu-secure" } }),
    );
  });

  it("picks the most recent parseable GPA", async () => {
    mockArFindMany.mockResolvedValue([
      { level: "MASTER", institution: "BUET", result: "3.9/4.0", passingYear: 2026 },
      { level: "BACHELOR", institution: "DU", result: "A+", passingYear: 2024 }, // not parseable
      { level: "HSC", institution: "College", result: "3.5/4.0", passingYear: 2020 },
    ]);

    const result = await getStudentGPA.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).gpa).toBe(3.9); // Most recent parseable
    expect(asOkData(result).level).toBe("MASTER");
  });

  it("wraps database errors in INTERNAL", async () => {
    mockArFindMany.mockRejectedValue(new Error("fail"));

    const result = await getStudentGPA.execute({}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
  });

  it("rejects ADMIN role", async () => {
    const result = await getStudentGPA.execute({}, makeAdminCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockArFindMany).not.toHaveBeenCalled();
  });
});
