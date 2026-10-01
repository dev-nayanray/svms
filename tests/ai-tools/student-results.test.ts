import { describe, it, expect, vi, beforeEach } from "vitest";

const mockArFindMany = vi.fn();
const mockEpFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    academicRecord: { findMany: (...a: unknown[]) => mockArFindMany(...a) },
    englishProficiency: { findMany: (...a: unknown[]) => mockEpFindMany(...a) },
  },
}));

import { getStudentResults } from "@/lib/ai/tools/student-results";
import { makeStudentCtx, makeAdminCtx, fixtureAcademicRecord, fixtureEnglishProficiency, asOkData } from "./_helpers";

describe("getStudentResults", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns academic records + English proficiency for a student", async () => {
    mockArFindMany.mockResolvedValue([fixtureAcademicRecord]);
    mockEpFindMany.mockResolvedValue([fixtureEnglishProficiency]);

    const result = await getStudentResults.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).academicRecords).toHaveLength(1);
    expect(asOkData(result).academicRecords[0].level).toBe("BACHELOR");
    expect(asOkData(result).academicRecords[0].result).toBe("3.8/4.0");
    expect(asOkData(result).englishProficiency).toHaveLength(1);
    expect(asOkData(result).englishProficiency[0].testType).toBe("IELTS");
    expect(asOkData(result).englishProficiency[0].overallScore).toBe(7.5);
  });

  it("queries both models with the authenticated studentId", async () => {
    mockArFindMany.mockResolvedValue([]);
    mockEpFindMany.mockResolvedValue([]);

    await getStudentResults.execute({}, makeStudentCtx({ studentId: "stu-xyz" }));

    expect(mockArFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "stu-xyz" } }),
    );
    expect(mockEpFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "stu-xyz" } }),
    );
  });

  it("returns empty arrays when no records exist", async () => {
    mockArFindMany.mockResolvedValue([]);
    mockEpFindMany.mockResolvedValue([]);

    const result = await getStudentResults.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).academicRecords).toEqual([]);
    expect(asOkData(result).englishProficiency).toEqual([]);
  });

  it("wraps database errors in INTERNAL", async () => {
    mockArFindMany.mockRejectedValue(new Error("Connection lost"));

    const result = await getStudentResults.execute({}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
  });

  it("rejects ADMIN role", async () => {
    const result = await getStudentResults.execute({}, makeAdminCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockArFindMany).not.toHaveBeenCalled();
    expect(mockEpFindMany).not.toHaveBeenCalled();
  });
});
