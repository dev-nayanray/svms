import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTaskFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    task: { findMany: (...a: unknown[]) => mockTaskFindMany(...a) },
  },
}));

import { getStudentAssignments } from "@/lib/ai/tools/student-assignments";
import { makeStudentCtx, makeAdminCtx, asOkData } from "./_helpers";

describe("getStudentAssignments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns pending tasks categorized by urgency", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tomorrow = new Date(now.getTime() + 86400000);

    mockTaskFindMany.mockResolvedValue([
      { id: "t1", title: "Upload passport", description: "Color scan", priority: "HIGH", status: "TODO", dueDate: yesterday, createdAt: now },
      { id: "t2", title: "Pay application fee", description: "€100", priority: "URGENT", status: "TODO", dueDate: tomorrow, createdAt: now },
      { id: "t3", title: "Book IELTS test", description: null, priority: "MEDIUM", status: "IN_PROGRESS", dueDate: null, createdAt: now },
    ]);

    const result = await getStudentAssignments.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).summary.total).toBe(3);
    expect(asOkData(result).summary.overdue).toBe(1); // t1
    expect(asOkData(result).overdue[0].title).toBe("Upload passport");
    expect(asOkData(result).note).toContain("application-process tasks");
  });

  it("queries with the authenticated studentId + soft-delete filter", async () => {
    mockTaskFindMany.mockResolvedValue([]);

    await getStudentAssignments.execute({}, makeStudentCtx({ studentId: "stu-abc" }));

    expect(mockTaskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "stu-abc",
          deletedAt: null,
          status: { in: ["TODO", "IN_PROGRESS"] },
        }),
      }),
    );
  });

  it("returns empty summary when no pending tasks", async () => {
    mockTaskFindMany.mockResolvedValue([]);

    const result = await getStudentAssignments.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).summary.total).toBe(0);
    expect(asOkData(result).overdue).toEqual([]);
    expect(asOkData(result).dueToday).toEqual([]);
    expect(asOkData(result).upcoming).toEqual([]);
  });

  it("wraps database errors in INTERNAL", async () => {
    mockTaskFindMany.mockRejectedValue(new Error("fail"));

    const result = await getStudentAssignments.execute({}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
  });

  it("rejects ADMIN role", async () => {
    const result = await getStudentAssignments.execute({}, makeAdminCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockTaskFindMany).not.toHaveBeenCalled();
  });
});
