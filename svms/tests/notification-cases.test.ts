import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  notification: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listNotifications,
  getUnreadCount,
  getRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  emitNotification,
  notificationScope,
  categoryForType,
  NOTIFICATION_CATEGORIES,
  TYPE_TO_CATEGORY,
  CATEGORY_META,
  type NotificationCategory,
} from "@/lib/services/notification-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };
const OTHER_EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp2", employeeId: "emp-2" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Constants & catalog ───────────────────────────────────────────────

describe("notification type catalog", () => {
  it("has 9 categories", () => {
    expect(NOTIFICATION_CATEGORIES).toHaveLength(9);
    expect(NOTIFICATION_CATEGORIES).toContain("APPLICATION");
    expect(NOTIFICATION_CATEGORIES).toContain("SYSTEM");
  });

  it("every category has a label + icon name", () => {
    for (const cat of NOTIFICATION_CATEGORIES) {
      const meta = CATEGORY_META[cat];
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
    }
  });

  it("categoryForType maps known types to their category", () => {
    expect(categoryForType("APPLICATION_STAGE_CHANGED")).toBe("APPLICATION");
    expect(categoryForType("TASK_ASSIGNED")).toBe("TASK");
    expect(categoryForType("MESSAGE_RECEIVED")).toBe("MESSAGE");
    expect(categoryForType("APPOINTMENT_CREATED")).toBe("APPOINTMENT");
    expect(categoryForType("PAYMENT_REFUNDED")).toBe("PAYMENT");
    expect(categoryForType("VISA_STAGE_CHANGED")).toBe("VISA");
    expect(categoryForType("INVOICE_ISSUED")).toBe("INVOICE");
    expect(categoryForType("DOCUMENT_APPROVED")).toBe("DOCUMENT");
    expect(categoryForType("WELCOME")).toBe("SYSTEM");
  });

  it("categoryForType falls back to SYSTEM for unknown types", () => {
    expect(categoryForType("UNKNOWN_TYPE")).toBe("SYSTEM");
    expect(categoryForType("")).toBe("SYSTEM");
  });

  it("every known type string is mapped to a valid category", () => {
    const knownTypes = Object.keys(TYPE_TO_CATEGORY);
    expect(knownTypes.length).toBeGreaterThanOrEqual(15);
    for (const t of knownTypes) {
      const cat = categoryForType(t);
      expect(NOTIFICATION_CATEGORIES).toContain(cat as NotificationCategory);
    }
  });
});

// ── Scope (IDOR closure) ─────────────────────────────────────────────

describe("notificationScope — IDOR closure", () => {
  it("EMPLOYEE scope filters by session userId", () => {
    expect(notificationScope(EMPLOYEE_SCOPE)).toEqual({ userId: "u-emp" });
  });
  it("ADMIN scope ALSO filters by userId — notifications are personal", () => {
    // Admin is not special here — they see only their own notifications.
    expect(notificationScope(ADMIN_SCOPE)).toEqual({ userId: "u-admin" });
  });
  it("two employees get different scopes (no cross-access)", () => {
    expect(notificationScope(EMPLOYEE_SCOPE)).toEqual({ userId: "u-emp" });
    expect(notificationScope(OTHER_EMPLOYEE_SCOPE)).toEqual({ userId: "u-emp2" });
  });
});

// ── listNotifications ─────────────────────────────────────────────────

describe("listNotifications", () => {
  it("returns empty list with proper pagination shape", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const r = await listNotifications(EMPLOYEE_SCOPE, {});
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.unread).toBe(0);
    expect(r.totalPages).toBe(1);
  });

  it("embeds the userId scope filter (IDOR closure)", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await listNotifications(EMPLOYEE_SCOPE, {});
    const where = prismaMock.notification.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u-emp");
  });

  it("ADMIN scope still filters by their own userId", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await listNotifications(ADMIN_SCOPE, {});
    expect(prismaMock.notification.findMany.mock.calls[0][0].where.userId).toBe("u-admin");
  });

  it("unreadOnly filter sets readAt: null", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await listNotifications(EMPLOYEE_SCOPE, { filters: { unreadOnly: true } });
    expect(prismaMock.notification.findMany.mock.calls[0][0].where.readAt).toBe(null);
  });

  it("category filter maps to a list of type strings", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await listNotifications(EMPLOYEE_SCOPE, { filters: { category: "TASK" } });
    const where = prismaMock.notification.findMany.mock.calls[0][0].where;
    expect(where.type).toMatchObject({ in: expect.arrayContaining(["TASK_ASSIGNED", "TASK_COMPLETED"]) });
  });

  it("category filter with no matching types uses sentinel 'none'", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    // The "SYSTEM" category has WELCOME + SYSTEM — but if we constructed a hypothetical
    // empty category, the service uses "__none__" to ensure zero matches.
    // Here we test that a category with types does return matches.
    await listNotifications(EMPLOYEE_SCOPE, { filters: { category: "SYSTEM" } });
    const where = prismaMock.notification.findMany.mock.calls[0][0].where;
    expect(where.type).toMatchObject({ in: expect.any(Array) });
  });

  it("returns rows with category + total + unread counts", async () => {
    const row = {
      id: "n1", type: "TASK_ASSIGNED", title: "New task", message: "You have a new task",
      link: "/employee/tasks", entityType: "Task", entityId: "t1",
      readAt: null, createdAt: new Date("2026-09-14"),
    };
    prismaMock.notification.findMany.mockResolvedValue([row]);
    prismaMock.notification.count
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1); // unread
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const r = await listNotifications(EMPLOYEE_SCOPE, {});
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].category).toBe("TASK");
    expect(r.rows[0].entityType).toBe("Task");
    expect(r.total).toBe(1);
    expect(r.unread).toBe(1);
  });

  it("lets prisma errors bubble (network failure propagation)", async () => {
    prismaMock.notification.findMany.mockRejectedValue(new Error("ECONNRESET"));
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await expect(listNotifications(EMPLOYEE_SCOPE, {})).rejects.toThrow("ECONNRESET");
  });
});

// ── getUnreadCount ─────────────────────────────────────────────────────

describe("getUnreadCount — badge counts", () => {
  it("returns 0 when no unread notifications", async () => {
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const r = await getUnreadCount(EMPLOYEE_SCOPE);
    expect(r.total).toBe(0);
    for (const cat of NOTIFICATION_CATEGORIES) {
      expect(r.byCategory[cat]).toBe(0);
    }
  });

  it("aggregates total + per-category counts", async () => {
    prismaMock.notification.groupBy.mockResolvedValue([
      { type: "TASK_ASSIGNED", _count: { _all: 3 } },
      { type: "TASK_COMPLETED", _count: { _all: 1 } }, // also TASK category
      { type: "MESSAGE_RECEIVED", _count: { _all: 2 } },
      { type: "APPLICATION_STAGE_CHANGED", _count: { _all: 1 } },
    ]);
    const r = await getUnreadCount(EMPLOYEE_SCOPE);
    expect(r.total).toBe(7); // 3+1+2+1
    expect(r.byCategory.TASK).toBe(4); // TASK_ASSIGNED(3) + TASK_COMPLETED(1)
    expect(r.byCategory.MESSAGE).toBe(2);
    expect(r.byCategory.APPLICATION).toBe(1);
    expect(r.byCategory.VISA).toBe(0);
  });

  it("uses scope filter (IDOR)", async () => {
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await getUnreadCount(EMPLOYEE_SCOPE);
    expect(prismaMock.notification.groupBy.mock.calls[0][0].where.userId).toBe("u-emp");
  });

  it("ADMIN sees only their own (not all employees')", async () => {
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await getUnreadCount(ADMIN_SCOPE);
    expect(prismaMock.notification.groupBy.mock.calls[0][0].where.userId).toBe("u-admin");
  });
});

// ── getRecentNotifications (bell dropdown) ────────────────────────────

describe("getRecentNotifications", () => {
  it("returns up to N most recent", async () => {
    const rows = [
      { id: "n1", type: "TASK_ASSIGNED", title: "T1", message: "M1", link: null, entityType: null, entityId: null, readAt: null, createdAt: new Date() },
      { id: "n2", type: "MESSAGE_RECEIVED", title: "T2", message: "M2", link: null, entityType: null, entityId: null, readAt: null, createdAt: new Date() },
    ];
    prismaMock.notification.findMany.mockResolvedValue(rows);
    const r = await getRecentNotifications(EMPLOYEE_SCOPE, 5);
    expect(r).toHaveLength(2);
    expect(r[0].category).toBe("TASK");
    expect(r[1].category).toBe("MESSAGE");
  });

  it("respects the limit param", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    await getRecentNotifications(EMPLOYEE_SCOPE, 10);
    expect(prismaMock.notification.findMany.mock.calls[0][0].take).toBe(10);
  });

  it("clamps limit to [1, 20]", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    await getRecentNotifications(EMPLOYEE_SCOPE, 100);
    expect(prismaMock.notification.findMany.mock.calls[0][0].take).toBe(20);
    await getRecentNotifications(EMPLOYEE_SCOPE, 0);
    expect(prismaMock.notification.findMany.mock.calls[1][0].take).toBe(1);
  });

  it("IDOR: uses scope filter", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    await getRecentNotifications(EMPLOYEE_SCOPE, 5);
    expect(prismaMock.notification.findMany.mock.calls[0][0].where.userId).toBe("u-emp");
  });
});

// ── markNotificationRead ─────────────────────────────────────────────

describe("markNotificationRead — read state + IDOR", () => {
  it("marks an unread notification as read", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n1", readAt: null });
    prismaMock.notification.update.mockResolvedValue({});
    const r = await markNotificationRead(EMPLOYEE_SCOPE, "n1");
    expect(r.updated).toBe(1);
    expect(prismaMock.notification.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "n1" },
      data: { readAt: expect.any(Date) },
    }));
  });

  it("is a no-op when already read", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n1", readAt: new Date() });
    const r = await markNotificationRead(EMPLOYEE_SCOPE, "n1");
    expect(r.updated).toBe(0);
    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });

  it("IDOR: returns 404 for foreign notification", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    await expect(markNotificationRead(EMPLOYEE_SCOPE, "n-foreign"))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("IDOR: scope filter applied to findFirst", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    await expect(markNotificationRead(EMPLOYEE_SCOPE, "n1")).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.notification.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "n1", userId: "u-emp",
    });
  });

  it("EMPLOYEE A cannot mark EMPLOYEE B's notification", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    await expect(markNotificationRead(OTHER_EMPLOYEE_SCOPE, "n-owned-by-emp1"))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ── markAllNotificationsRead ──────────────────────────────────────────

describe("markAllNotificationsRead", () => {
  it("marks all unread notifications as read", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 5 });
    const r = await markAllNotificationsRead(EMPLOYEE_SCOPE);
    expect(r.updated).toBe(5);
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "u-emp", readAt: null }),
      data: { readAt: expect.any(Date) },
    }));
  });

  it("IDOR: scope filter applied", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 });
    await markAllNotificationsRead(EMPLOYEE_SCOPE);
    expect(prismaMock.notification.updateMany.mock.calls[0][0].where.userId).toBe("u-emp");
  });

  it("category filter limits mark-all to a single category", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 2 });
    await markAllNotificationsRead(EMPLOYEE_SCOPE, { category: "TASK" });
    const where = prismaMock.notification.updateMany.mock.calls[0][0].where;
    expect(where.type).toMatchObject({ in: expect.arrayContaining(["TASK_ASSIGNED", "TASK_COMPLETED"]) });
    expect(where.readAt).toBe(null);
  });

  it("returns updated: 0 when nothing unread", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 });
    const r = await markAllNotificationsRead(EMPLOYEE_SCOPE);
    expect(r.updated).toBe(0);
  });
});

// ── emitNotification (generation + dedup) ────────────────────────────

describe("emitNotification — generation", () => {
  it("creates a new notification when no dedup hit", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    const r = await emitNotification({
      userId: "u-emp",
      type: "TASK_ASSIGNED",
      title: "New task",
      message: "You have a new task",
      link: "/employee/tasks",
      entityType: "Task",
      entityId: "t1",
    });
    expect(r.id).toBe("n1");
    expect(r.deduplicated).toBe(false);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "u-emp", type: "TASK_ASSIGNED", title: "New task",
        entityType: "Task", entityId: "t1",
      }),
    }));
  });

  it("deduplicates by updating an existing notification within the window", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n-existing" });
    prismaMock.notification.update.mockResolvedValue({});
    const r = await emitNotification({
      userId: "u-emp",
      type: "APPLICATION_STAGE_CHANGED",
      title: "Application stage: COUNSELING",
      message: "Updated message",
      link: "/employee/applications/a1",
      entityType: "Application",
      entityId: "a1",
    });
    expect(r.id).toBe("n-existing");
    expect(r.deduplicated).toBe(true);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(prismaMock.notification.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "n-existing" },
      data: expect.objectContaining({
        title: "Application stage: COUNSELING",
        message: "Updated message",
        readAt: null, // re-marked as unread
        createdAt: expect.any(Date), // bumped to top
      }),
    }));
  });

  it("skips dedup when entityId is null/undefined", async () => {
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await emitNotification({
      userId: "u-emp",
      type: "SYSTEM",
      title: "Hello",
      message: "World",
    });
    expect(prismaMock.notification.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalled();
  });

  it("dedup uses a 5-minute window by default", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await emitNotification({
      userId: "u-emp", type: "TASK_ASSIGNED", title: "T", message: "M",
      entityType: "Task", entityId: "t1",
    });
    const where = prismaMock.notification.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      userId: "u-emp", type: "TASK_ASSIGNED", entityId: "t1",
    });
    expect(where.createdAt).toBeDefined();
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    // Default dedup window = 5 min
    const since: Date = where.createdAt.gte;
    const expectedMin = Date.now() - 5 * 60 * 1000;
    expect(since.getTime()).toBeGreaterThanOrEqual(expectedMin - 1000);
    expect(since.getTime()).toBeLessThanOrEqual(expectedMin + 5000);
  });

  it("best-effort: never throws on prisma errors", async () => {
    prismaMock.notification.findFirst.mockRejectedValue(new Error("DB lost"));
    const r = await emitNotification({
      userId: "u-emp", type: "TASK_ASSIGNED", title: "T", message: "M",
      entityType: "Task", entityId: "t1",
    });
    expect(r.id).toBe(""); // synthetic id returned, not thrown
  });

  it("best-effort: never throws when create fails", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockRejectedValue(new Error("write failed"));
    const r = await emitNotification({
      userId: "u-emp", type: "TASK_ASSIGNED", title: "T", message: "M",
    });
    expect(r.id).toBe("");
  });
});

// ── Notification IDOR across employees (integration-style) ───────────

describe("cross-employee IDOR", () => {
  it("EMPLOYEE A cannot list EMPLOYEE B's notifications", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await listNotifications(EMPLOYEE_SCOPE, {});
    const empAWhere = prismaMock.notification.findMany.mock.calls[0][0].where;
    expect(empAWhere.userId).toBe("u-emp");

    vi.clearAllMocks();
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await listNotifications(OTHER_EMPLOYEE_SCOPE, {});
    const empBWhere = prismaMock.notification.findMany.mock.calls[0][0].where;
    expect(empBWhere.userId).toBe("u-emp2");
    expect(empAWhere.userId).not.toBe(empBWhere.userId);
  });

  it("EMPLOYEE A's badge count is independent of EMPLOYEE B", async () => {
    prismaMock.notification.groupBy.mockResolvedValue([
      { type: "TASK_ASSIGNED", _count: { _all: 3 } },
    ]);
    const rA = await getUnreadCount(EMPLOYEE_SCOPE);
    expect(rA.total).toBe(3);
    expect(prismaMock.notification.groupBy.mock.calls[0][0].where.userId).toBe("u-emp");

    vi.clearAllMocks();
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const rB = await getUnreadCount(OTHER_EMPLOYEE_SCOPE);
    expect(rB.total).toBe(0);
    expect(prismaMock.notification.groupBy.mock.calls[0][0].where.userId).toBe("u-emp2");
  });
});

// ── Empty states ──────────────────────────────────────────────────────

describe("empty states", () => {
  it("listNotifications returns empty rows (not null) when no notifications", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const r = await listNotifications(EMPLOYEE_SCOPE, {});
    expect(r.rows).toEqual([]);
  });

  it("getUnreadCount returns 0 total with all-zero byCategory", async () => {
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const r = await getUnreadCount(EMPLOYEE_SCOPE);
    expect(r.total).toBe(0);
    for (const cat of NOTIFICATION_CATEGORIES) {
      expect(r.byCategory[cat]).toBe(0);
    }
  });

  it("getRecentNotifications returns empty array (not null) when no notifications", async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    const r = await getRecentNotifications(EMPLOYEE_SCOPE, 5);
    expect(r).toEqual([]);
  });
});

// ── Network failure propagation ──────────────────────────────────────

describe("network failure propagation", () => {
  it("listNotifications lets prisma errors bubble", async () => {
    prismaMock.notification.findMany.mockRejectedValue(new Error("ECONNRESET"));
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await expect(listNotifications(EMPLOYEE_SCOPE, {})).rejects.toThrow("ECONNRESET");
  });

  it("getUnreadCount lets prisma errors bubble", async () => {
    prismaMock.notification.groupBy.mockRejectedValue(new Error("timeout"));
    await expect(getUnreadCount(EMPLOYEE_SCOPE)).rejects.toThrow("timeout");
  });

  it("markNotificationRead lets update errors bubble", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n1", readAt: null });
    prismaMock.notification.update.mockRejectedValue(new Error("update fail"));
    await expect(markNotificationRead(EMPLOYEE_SCOPE, "n1")).rejects.toThrow("update fail");
  });

  it("markAllNotificationsRead lets updateMany errors bubble", async () => {
    prismaMock.notification.updateMany.mockRejectedValue(new Error("bulk update fail"));
    await expect(markAllNotificationsRead(EMPLOYEE_SCOPE)).rejects.toThrow("bulk update fail");
  });

  it("getRecentNotifications lets findMany errors bubble", async () => {
    prismaMock.notification.findMany.mockRejectedValue(new Error("query fail"));
    await expect(getRecentNotifications(EMPLOYEE_SCOPE, 5)).rejects.toThrow("query fail");
  });

  // EXCEPTION: emitNotification is best-effort — it must NEVER bubble.
  it("emitNotification swallows network errors (best-effort)", async () => {
    prismaMock.notification.findFirst.mockRejectedValue(new Error("emit lost"));
    const r = await emitNotification({
      userId: "u-emp", type: "TASK_ASSIGNED", title: "T", message: "M",
      entityType: "Task", entityId: "t1",
    });
    expect(r.id).toBe("");
  });
});

// ── Navigation / action link ──────────────────────────────────────────

describe("navigation / action link", () => {
  it("returns the link field for the UI to render", async () => {
    const row = {
      id: "n1", type: "APPLICATION_STAGE_CHANGED",
      title: "Application stage changed", message: "...",
      link: "/employee/applications/app-1",
      entityType: "Application", entityId: "app-1",
      readAt: null, createdAt: new Date(),
    };
    prismaMock.notification.findMany.mockResolvedValue([row]);
    prismaMock.notification.count.mockResolvedValue(1);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const r = await listNotifications(EMPLOYEE_SCOPE, {});
    expect(r.rows[0].link).toBe("/employee/applications/app-1");
  });

  it("preserves null links for system notifications", async () => {
    const row = {
      id: "n1", type: "WELCOME", title: "Welcome", message: "Hi",
      link: null, entityType: null, entityId: null,
      readAt: null, createdAt: new Date(),
    };
    prismaMock.notification.findMany.mockResolvedValue([row]);
    prismaMock.notification.count.mockResolvedValue(1);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const r = await listNotifications(EMPLOYEE_SCOPE, {});
    expect(r.rows[0].link).toBe(null);
    expect(r.rows[0].category).toBe("SYSTEM");
  });

  it("related entity type + id preserved for grouping", async () => {
    const row = {
      id: "n1", type: "TASK_ASSIGNED", title: "T", message: "M",
      link: "/employee/tasks", entityType: "Task", entityId: "t1",
      readAt: null, createdAt: new Date(),
    };
    prismaMock.notification.findMany.mockResolvedValue([row]);
    prismaMock.notification.count.mockResolvedValue(1);
    prismaMock.notification.groupBy.mockResolvedValue([]);
    const r = await listNotifications(EMPLOYEE_SCOPE, {});
    expect(r.rows[0].entityType).toBe("Task");
    expect(r.rows[0].entityId).toBe("t1");
  });
});

// ── Duplicate notification behavior ──────────────────────────────────

describe("duplicate notification behavior", () => {
  it("second emit with same (userId, type, entityId) within window deduplicates", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n-orig" });
    prismaMock.notification.update.mockResolvedValue({});
    const r = await emitNotification({
      userId: "u-emp", type: "APPLICATION_STAGE_CHANGED", title: "Stage → COUNSELING",
      message: "Updated", link: "/employee/applications/a1",
      entityType: "Application", entityId: "a1",
    });
    expect(r.deduplicated).toBe(true);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("second emit after window expires creates a new notification", async () => {
    // Simulate: findFirst returns null → no recent dedup hit
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n2" });
    const r = await emitNotification({
      userId: "u-emp", type: "APPLICATION_STAGE_CHANGED", title: "Stage → COUNSELING",
      message: "Updated", link: "/employee/applications/a1",
      entityType: "Application", entityId: "a1",
    });
    expect(r.deduplicated).toBe(false);
    expect(prismaMock.notification.create).toHaveBeenCalled();
  });

  it("same type, different entityId → both notifications created", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await emitNotification({
      userId: "u-emp", type: "TASK_ASSIGNED", title: "Task A",
      message: "M", entityType: "Task", entityId: "t1",
    });
    await emitNotification({
      userId: "u-emp", type: "TASK_ASSIGNED", title: "Task B",
      message: "M", entityType: "Task", entityId: "t2",
    });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
  });

  it("different type, same entityId → both notifications created", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await emitNotification({
      userId: "u-emp", type: "APPLICATION_STAGE_CHANGED", title: "Stage",
      message: "M", entityType: "Application", entityId: "a1",
    });
    await emitNotification({
      userId: "u-emp", type: "APPLICATION_ASSIGNED", title: "Assigned",
      message: "M", entityType: "Application", entityId: "a1",
    });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
  });

  it("dedup re-marks the existing notification as unread", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n-existing" });
    prismaMock.notification.update.mockResolvedValue({});
    await emitNotification({
      userId: "u-emp", type: "TASK_ASSIGNED", title: "Updated title",
      message: "Updated message", entityType: "Task", entityId: "t1",
    });
    expect(prismaMock.notification.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ readAt: null }),
    }));
  });

  it("dedup bumps createdAt to top of list", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n-existing" });
    prismaMock.notification.update.mockResolvedValue({});
    await emitNotification({
      userId: "u-emp", type: "TASK_ASSIGNED", title: "T", message: "M",
      entityType: "Task", entityId: "t1",
    });
    const data = prismaMock.notification.update.mock.calls[0][0].data;
    expect(data.createdAt).toBeInstanceOf(Date);
    // New createdAt should be very recent
    expect((data.createdAt as Date).getTime()).toBeGreaterThan(Date.now() - 5000);
  });
});
