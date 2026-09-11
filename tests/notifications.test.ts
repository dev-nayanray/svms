import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_ICONS,
  NOTIFICATION_READ_FILTERS,
  NOTIFICATION_READ_FILTER_LABELS,
  MESSAGE_VISIBILITIES,
  MESSAGE_VISIBILITY_LABELS,
  isMessageVisibleTo,
  buildNotificationWhere,
  buildConversationWhere,
} from "@/lib/constants/notifications";

describe("notification type enums", () => {
  it("exposes the 13 canonical notification types", () => {
    expect(NOTIFICATION_TYPES).toEqual([
      "DOCUMENT_UPLOADED",
      "DOCUMENT_APPROVED",
      "DOCUMENT_REJECTED",
      "DOCUMENT_REUPLOAD_REQUESTED",
      "APPLICATION_STAGE_CHANGED",
      "TASK_ASSIGNED",
      "TASK_COMPLETED",
      "TASK_CANCELLED",
      "PAYMENT_RECORDED",
      "PAYMENT_DUE",
      "VISA_STAGE_CHANGED",
      "COUNSELING_REQUEST",
      "NEW_MESSAGE",
    ]);
  });

  it("labels every notification type", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(NOTIFICATION_TYPE_LABELS[type]).toBeDefined();
      expect(NOTIFICATION_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it("has an icon for every notification type", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(NOTIFICATION_TYPE_ICONS[type]).toBeDefined();
      expect(NOTIFICATION_TYPE_ICONS[type].length).toBeGreaterThan(0);
    }
  });
});

describe("notification read filters", () => {
  it("exposes all/unread/read", () => {
    expect(NOTIFICATION_READ_FILTERS).toEqual(["all", "unread", "read"]);
  });

  it("labels every filter", () => {
    expect(NOTIFICATION_READ_FILTER_LABELS.all).toBe("All");
    expect(NOTIFICATION_READ_FILTER_LABELS.unread).toBe("Unread");
    expect(NOTIFICATION_READ_FILTER_LABELS.read).toBe("Read");
  });
});

describe("message visibility enums", () => {
  it("exposes INTERNAL and STUDENT", () => {
    expect(MESSAGE_VISIBILITIES).toEqual(["INTERNAL", "STUDENT"]);
  });

  it("labels every visibility", () => {
    expect(MESSAGE_VISIBILITY_LABELS.INTERNAL).toMatch(/staff only/i);
    expect(MESSAGE_VISIBILITY_LABELS.STUDENT).toMatch(/student/i);
  });
});

describe("isMessageVisibleTo", () => {
  it("INTERNAL messages are visible to ADMIN", () => {
    expect(isMessageVisibleTo("INTERNAL", "ADMIN")).toBe(true);
  });

  it("INTERNAL messages are visible to EMPLOYEE", () => {
    expect(isMessageVisibleTo("INTERNAL", "EMPLOYEE")).toBe(true);
  });

  it("INTERNAL messages are NOT visible to STUDENT (privilege escalation prevention)", () => {
    expect(isMessageVisibleTo("INTERNAL", "STUDENT")).toBe(false);
  });

  it("STUDENT messages are visible to all roles", () => {
    expect(isMessageVisibleTo("STUDENT", "ADMIN")).toBe(true);
    expect(isMessageVisibleTo("STUDENT", "EMPLOYEE")).toBe(true);
    expect(isMessageVisibleTo("STUDENT", "STUDENT")).toBe(true);
  });

  it("unknown visibility defaults to visible (safe default = no false denial of service)", () => {
    expect(isMessageVisibleTo("UNKNOWN", "ADMIN")).toBe(true);
    expect(isMessageVisibleTo("UNKNOWN", "STUDENT")).toBe(true);
  });
});

describe("buildNotificationWhere", () => {
  it("always filters by userId", () => {
    const where = buildNotificationWhere({ userId: "user-1" });
    expect(where.AND).toContainEqual({ userId: "user-1" });
  });

  it("adds readAt null for unread filter", () => {
    const where = buildNotificationWhere({ userId: "u1", readFilter: "unread" });
    expect(where.AND).toContainEqual({ readAt: null });
  });

  it("adds readAt not-null for read filter", () => {
    const where = buildNotificationWhere({ userId: "u1", readFilter: "read" });
    expect(where.AND).toContainEqual({ readAt: { not: null } });
  });

  it("does not add a readAt clause for all filter", () => {
    const where = buildNotificationWhere({ userId: "u1", readFilter: "all" });
    const hasReadClause = (where.AND as Record<string, unknown>[]).some(
      (c) => "readAt" in c,
    );
    expect(hasReadClause).toBe(false);
  });

  it("searches across title, message, and type", () => {
    const where = buildNotificationWhere({ userId: "u1", search: "payment" });
    expect(where.AND).toContainEqual({
      OR: [
        { title: { contains: "payment", mode: "insensitive" } },
        { message: { contains: "payment", mode: "insensitive" } },
        { type: { contains: "payment", mode: "insensitive" } },
      ],
    });
  });

  it("trims whitespace from search", () => {
    const where = buildNotificationWhere({ userId: "u1", search: "  task  " });
    expect(where.AND).toContainEqual({
      OR: [
        { title: { contains: "task", mode: "insensitive" } },
        { message: { contains: "task", mode: "insensitive" } },
        { type: { contains: "task", mode: "insensitive" } },
      ],
    });
  });

  it("combines userId + readFilter + search into a single AND chain", () => {
    const where = buildNotificationWhere({
      userId: "u1",
      readFilter: "unread",
      search: "visa",
    });
    expect(where.AND).toHaveLength(3);
  });
});

describe("buildConversationWhere", () => {
  it("returns empty for no filters", () => {
    const where = buildConversationWhere({});
    expect(where).toEqual({});
  });

  it("applies employeeId filter", () => {
    const where = buildConversationWhere({ employeeId: "emp-1" });
    expect(where.AND).toContainEqual({ employeeId: "emp-1" });
  });

  it("searches across student name, student ID, and employee name", () => {
    const where = buildConversationWhere({ search: "Karim" });
    expect(where.AND).toContainEqual({
      OR: [
        { student: { firstName: { contains: "Karim", mode: "insensitive" } } },
        { student: { lastName: { contains: "Karim", mode: "insensitive" } } },
        { student: { studentId: { contains: "Karim", mode: "insensitive" } } },
        { employee: { user: { name: { contains: "Karim", mode: "insensitive" } } } },
      ],
    });
  });

  it("combines employeeId + search into a single AND chain", () => {
    const where = buildConversationWhere({ employeeId: "emp-1", search: "Karim" });
    expect(where.AND).toHaveLength(2);
  });
});
