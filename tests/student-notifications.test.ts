import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockNotificationFindMany = vi.fn();
const mockNotificationFindFirst = vi.fn();
const mockNotificationCount = vi.fn();
const mockNotificationUpdate = vi.fn();
const mockNotificationUpdateMany = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockStudentFindFirst(args) },
    notification: {
      findMany: (args: unknown) => mockNotificationFindMany(args),
      findFirst: (args: unknown) => mockNotificationFindFirst(args),
      count: (args: unknown) => mockNotificationCount(args),
      update: (args: unknown) => mockNotificationUpdate(args),
      updateMany: (args: unknown) => mockNotificationUpdateMany(args),
    },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: { record: (input: unknown) => mockAuditRecord(input) },
}));

import { GET as GET_list } from "@/app/api/student/notifications/route";
import { PATCH as PATCH_read } from "@/app/api/student/notifications/[id]/read/route";
import { POST as POST_readAll } from "@/app/api/student/notifications/read-all/route";

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

const unreadNotif = {
  id: "notif-1",
  userId: "user-1",
  type: "DOCUMENT_APPROVED",
  title: "Document approved",
  message: "Your passport has been approved.",
  link: "/student/documents",
  readAt: null,
  createdAt: new Date("2026-09-12T10:00:00Z"),
};

const readNotif = {
  id: "notif-2",
  userId: "user-1",
  type: "NEW_MESSAGE",
  title: "New message",
  message: "Your counselor sent you a message.",
  link: "/student/messages",
  readAt: new Date("2026-09-11T08:00:00Z"),
  createdAt: new Date("2026-09-11T08:00:00Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockNotificationFindMany.mockResolvedValue([unreadNotif, readNotif]);
  mockNotificationFindFirst.mockResolvedValue(unreadNotif);
  mockNotificationCount.mockResolvedValue(1); // unread count
  mockNotificationUpdate.mockResolvedValue({ ...unreadNotif, readAt: new Date() });
  mockNotificationUpdateMany.mockResolvedValue({ count: 1 });
  mockAuditRecord.mockResolvedValue(undefined);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makeReq(url: string, method = "GET"): NextRequest {
  return new NextRequest(url, { method });
}

// ─────────────────────────────────────────────
// GET /api/student/notifications (list)
// ─────────────────────────────────────────────

describe("GET /api/student/notifications (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(makeReq("http://localhost/api/student/notifications"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(makeReq("http://localhost/api/student/notifications"));
    expect(res.status).toBe(403);
  });

  it("returns the caller's notifications with unread count", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(makeReq("http://localhost/api/student/notifications"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBe(2);
    expect(body.data.unreadCount).toBe(1);
    expect(body.data.totalCount).toBeDefined();
  });

  it("each notification has icon, typeLabel, isRead flag, and category", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(makeReq("http://localhost/api/student/notifications"));
    const body = await res.json();
    const item = body.data.items[0];
    expect(item.icon).toBeDefined();
    expect(item.typeLabel).toBe("Document Approved");
    expect(item.isRead).toBe(false);
    expect(item.category).toBe("documents");
    expect(item.link).toBe("/student/documents");
  });

  it("scopes findMany by userId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/notifications"));
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });

  it("supports ?category=unread filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/notifications?category=unread"));
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", readAt: null }),
      }),
    );
  });

  it("supports ?category=documents filter (type in clause)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/notifications?category=documents"));
    const whereArg = mockNotificationFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.type).toEqual({
      in: ["DOCUMENT_UPLOADED", "DOCUMENT_APPROVED", "DOCUMENT_REJECTED", "DOCUMENT_REUPLOAD_REQUESTED"],
    });
  });

  it("supports ?category=messages filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/notifications?category=messages"));
    const whereArg = mockNotificationFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.type).toEqual({ in: ["NEW_MESSAGE"] });
  });

  it("supports ?category=visa filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/notifications?category=visa"));
    const whereArg = mockNotificationFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.type).toEqual({ in: ["VISA_STAGE_CHANGED"] });
  });

  it("supports ?category=payments filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/notifications?category=payments"));
    const whereArg = mockNotificationFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.type).toEqual({ in: ["PAYMENT_RECORDED", "PAYMENT_DUE"] });
  });

  it("supports ?category=application filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeReq("http://localhost/api/student/notifications?category=application"));
    const whereArg = mockNotificationFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.type).toEqual({ in: ["APPLICATION_STAGE_CHANGED", "COUNSELING_REQUEST"] });
  });

  it("returns the correct unreadCount across ALL categories (not filtered)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Even when filtering by category=documents, the unreadCount should
    // be the total across all categories (for the badge).
    mockNotificationCount
      .mockResolvedValueOnce(3) // first call: total unread (for badge)
      .mockResolvedValueOnce(5); // second call: total count

    const res = await GET_list(makeReq("http://localhost/api/student/notifications?category=documents"));
    const body = await res.json();
    expect(body.data.unreadCount).toBe(3); // total across all categories
  });
});

// ─────────────────────────────────────────────
// PATCH /api/student/notifications/[id]/read
// ─────────────────────────────────────────────

describe("PATCH /api/student/notifications/[id]/read", () => {
  async function callPatch(id: string) {
    return PATCH_read(
      makeReq(`http://localhost/api/student/notifications/${id}/read`, "PATCH"),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callPatch("notif-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the notification doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockNotificationFindFirst.mockResolvedValue(null);
    const res = await callPatch("foreign-notif-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("marks the notification as read", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch("notif-1");
    expect(res.status).toBe(200);
    expect(mockNotificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notif-1" },
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
  });

  it("scopes findFirst by userId (ownership check)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callPatch("notif-1");
    expect(mockNotificationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "notif-1", userId: "user-1" }),
      }),
    );
  });

  it("audit-logs the read action", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callPatch("notif-1");
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "notification.marked_read",
        entity: "Notification",
        entityId: "notif-1",
      }),
    );
  });

  it("is a no-op when the notification is already read", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockNotificationFindFirst.mockResolvedValue({ ...unreadNotif, readAt: new Date("2026-09-11") });
    const res = await callPatch("notif-1");
    expect(res.status).toBe(200);
    // No update should happen when already read
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// POST /api/student/notifications/read-all
// ─────────────────────────────────────────────

describe("POST /api/student/notifications/read-all", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await POST_readAll(makeReq("http://localhost/api/student/notifications/read-all", "POST"));
    expect(res.status).toBe(401);
  });

  it("marks all unread notifications as read", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await POST_readAll(makeReq("http://localhost/api/student/notifications/read-all", "POST"));
    expect(res.status).toBe(200);
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", readAt: null }),
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
  });

  it("returns the count of notifications marked", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockNotificationUpdateMany.mockResolvedValue({ count: 5 });
    const res = await POST_readAll(makeReq("http://localhost/api/student/notifications/read-all", "POST"));
    const body = await res.json();
    expect(body.data.count).toBe(5);
  });

  it("audit-logs the bulk read action", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockNotificationUpdateMany.mockResolvedValue({ count: 3 });
    await POST_readAll(makeReq("http://localhost/api/student/notifications/read-all", "POST"));
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "notification.marked_all_read",
        entity: "Notification",
        newValue: { count: 3 },
      }),
    );
  });

  it("does not audit-log when count is 0 (no-op)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockNotificationUpdateMany.mockResolvedValue({ count: 0 });
    await POST_readAll(makeReq("http://localhost/api/student/notifications/read-all", "POST"));
    expect(mockAuditRecord).not.toHaveBeenCalled();
  });
});
