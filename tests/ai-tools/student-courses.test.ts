import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAppFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    application: { findMany: (...args: unknown[]) => mockAppFindMany(...args) },
  },
}));

import { getStudentCourses } from "@/lib/ai/tools/student-courses";
import { makeStudentCtx, makeAdminCtx, asOkData } from "./_helpers";

describe("getStudentCourses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns applied courses for an authenticated student", async () => {
    mockAppFindMany.mockResolvedValue([
      {
        id: "app-1",
        applicationNumber: "SV-2026-000001",
        studentId: "stu-001",
        stageKey: "DOCUMENT_REVIEW",
        status: "ACTIVE",
        priority: "HIGH",
        submissionDate: new Date("2026-09-01"),
        deletedAt: null,
        course: {
          id: "crs-1",
          name: "MSc Computer Science",
          degreeLevel: "MASTER",
          duration: "2 years",
          tuitionFee: 15000,
          currency: "EUR",
          ieltsRequirement: "6.5 overall",
          university: { name: "TU Munich", city: "Munich", ranking: 50 },
        },
        country: { name: "Germany", flag: "🇩🇪" },
        intake: { name: "Winter 2026", month: 10, year: 2026 },
      },
    ]);

    const result = await getStudentCourses.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).totalApplications).toBe(1);
    expect(asOkData(result).courses[0].course.name).toBe("MSc Computer Science");
    expect(asOkData(result).courses[0].university.name).toBe("TU Munich");
    expect(asOkData(result).courses[0].country.flag).toBe("🇩🇪");
  });

  it("queries with the authenticated studentId", async () => {
    mockAppFindMany.mockResolvedValue([]);

    await getStudentCourses.execute({}, makeStudentCtx({ studentId: "stu-from-session" }));

    expect(mockAppFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "stu-from-session",
          deletedAt: null,
        }),
      }),
    );
  });

  it("returns empty list when student has no applications", async () => {
    mockAppFindMany.mockResolvedValue([]);

    const result = await getStudentCourses.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).totalApplications).toBe(0);
    expect(asOkData(result).courses).toEqual([]);
  });

  it("handles applications without a course selected yet", async () => {
    mockAppFindMany.mockResolvedValue([
      {
        id: "app-1",
        applicationNumber: "SV-2026-000002",
        studentId: "stu-001",
        stageKey: "LEAD",
        status: "ACTIVE",
        priority: "MEDIUM",
        submissionDate: null,
        deletedAt: null,
        course: null, // No course selected yet
        country: { name: "Germany", flag: "🇩🇪" },
        intake: null,
      },
    ]);

    const result = await getStudentCourses.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).courses[0].course).toBeNull();
  });

  it("wraps database errors in INTERNAL", async () => {
    mockAppFindMany.mockRejectedValue(new Error("DB timeout"));

    const result = await getStudentCourses.execute({}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
  });

  it("rejects ADMIN role", async () => {
    const result = await getStudentCourses.execute({}, makeAdminCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockAppFindMany).not.toHaveBeenCalled();
  });
});
