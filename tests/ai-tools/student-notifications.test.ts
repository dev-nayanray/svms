import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStudentFindFirst = vi.fn();
const mockNotifCount = vi.fn();
const mockNotifFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (...a: unknown[]) => mockStudentFindFirst(...a) },
    notification: {
      count: (...a: unknown[]) => mockNotifCount(...a),
      findMany: (...a: unknown[]) => mockNotifFindMany(...a),
    },
  },
}));

import { getStudentNotifications } from "@/lib/ai/tools/student-notifications";
import { makeStudentCtx, makeAdminCtx, fixtureNotification, asOkData } from "./_helpers";

describe("getStudentNotifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns unread count + recent notifications for a student", async () => {
    mockStudentFindFirst.mockResolvedValue({ userId: "user-001" });
    mockNotifCount.mockResolvedValue(3);
    mockNotifFindMany.mockResolvedValue([fixtureNotification]);

    const result = await getStudentNotifications.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).unreadCount).toBe(3);
    expect(asOkData(result).recent).toHaveLength(1);
    expect(asOkData(result).recent[0].title).toBe("Document Approved");
    expect(asOkData(result).recent[0].isRead).toBe(false);
  });

  it("resolves userId from the authenticated studentId, then queries by userId", async () => {
    mockStudentFindFirst.mockResolvedValue({ userId: "user-derived-from-session" });
    mockNotifCount.mockResolvedValue(0);
    mockNotifFindMany.mockResolvedValue([]);

    await getStudentNotifications.execute({}, makeStudentCtx({ studentId: "stu-from-session" }));

    // Step 1: Student lookup by ctx.studentId (NOT from args)
    expect(mockStudentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stu-from-session", deletedAt: null },
      }),
    );

    // Step 2: Notification queries use the student's userId (derived)
    expect(mockNotifCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-derived-from-session", readAt: null },
      }),
    );
    expect(mockNotifFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-derived-from-session" },
      }),
    );
  });

  it("returns NOT_FOUND when no student exists for the session studentId", async () => {
    mockStudentFindFirst.mockResolvedValue(null);

    const result = await getStudentNotifications.execute(
      {},
      makeStudentCtx({ studentId: "nonexistent" }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    // Should NOT have queried notifications
    expect(mockNotifCount).not.toHaveBeenCalled();
    expect(mockNotifFindMany).not.toHaveBeenCalled();
  });

  it("returns zero unread when all notifications are read", async () => {
    mockStudentFindFirst.mockResolvedValue({ userId: "user-001" });
    mockNotifCount.mockResolvedValue(0);
    mockNotifFindMany.mockResolvedValue([
      { ...fixtureNotification, readAt: new Date("2026-09-21") },
    ]);

    const result = await getStudentNotifications.execute({}, makeStudentCtx());

    expect(result.ok).toBe(true);
    expect(asOkData(result).unreadCount).toBe(0);
    expect(asOkData(result).recent[0].isRead).toBe(true);
  });

  it("wraps database errors in INTERNAL", async () => {
    mockStudentFindFirst.mockRejectedValue(new Error("fail"));

    const result = await getStudentNotifications.execute({}, makeStudentCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
  });

  it("rejects ADMIN role", async () => {
    const result = await getStudentNotifications.execute({}, makeAdminCtx());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(mockStudentFindFirst).not.toHaveBeenCalled();
  });
});
