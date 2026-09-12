import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { auditLog } from "./audit";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_ICONS,
} from "@/lib/constants/notifications";

/**
 * Student-scoped Notifications service for Module 14.
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `userId` resolved from the session
 * (via `studentApiGuard()` → `g.userId`). The service NEVER trusts a
 * `notificationId` from the client without re-verifying ownership.
 * Foreign/missing records return null → 404.
 *
 * TYPE CATEGORIES
 * ----------------
 * The UI groups notification types into categories for the filter tabs:
 *  - application: APPLICATION_STAGE_CHANGED, COUNSELING_REQUEST
 *  - documents: DOCUMENT_UPLOADED, DOCUMENT_APPROVED, DOCUMENT_REJECTED,
 *    DOCUMENT_REUPLOAD_REQUESTED
 *  - visa: VISA_STAGE_CHANGED
 *  - payments: PAYMENT_RECORDED, PAYMENT_DUE
 *  - messages: NEW_MESSAGE
 *  - tasks: TASK_ASSIGNED, TASK_COMPLETED, TASK_CANCELLED
 */

export type NotificationCategory =
  | "all"
  | "unread"
  | "application"
  | "documents"
  | "visa"
  | "payments"
  | "messages"
  | "tasks";

const CATEGORY_TYPE_MAP: Record<Exclude<NotificationCategory, "all" | "unread">, string[]> = {
  application: ["APPLICATION_STAGE_CHANGED", "COUNSELING_REQUEST"],
  documents: ["DOCUMENT_UPLOADED", "DOCUMENT_APPROVED", "DOCUMENT_REJECTED", "DOCUMENT_REUPLOAD_REQUESTED"],
  visa: ["VISA_STAGE_CHANGED"],
  payments: ["PAYMENT_RECORDED", "PAYMENT_DUE"],
  messages: ["NEW_MESSAGE"],
  tasks: ["TASK_ASSIGNED", "TASK_COMPLETED", "TASK_CANCELLED"],
};

export type NotificationItem = {
  id: string;
  type: string;
  typeLabel: string;
  icon: string;
  title: string;
  message: string;
  link: string | null;
  readAt: Date | null;
  isRead: boolean;
  category: string;
  createdAt: Date;
};

function categorize(type: string): string {
  for (const [cat, types] of Object.entries(CATEGORY_TYPE_MAP)) {
    if (types.includes(type)) return cat;
  }
  return "other";
}

function buildItem(row: {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    typeLabel: NOTIFICATION_TYPE_LABELS[row.type as keyof typeof NOTIFICATION_TYPE_LABELS] ?? row.type,
    icon: NOTIFICATION_TYPE_ICONS[row.type as keyof typeof NOTIFICATION_TYPE_ICONS] ?? "Bell",
    title: row.title,
    message: row.message,
    link: row.link,
    readAt: row.readAt,
    isRead: !!row.readAt,
    category: categorize(row.type),
    createdAt: row.createdAt,
  };
}

export const studentNotificationService = {
  /**
   * List the caller's notifications with optional category filter.
   * Scoped by `userId` from the session. Newest-first.
   */
  async list(userId: string, category: NotificationCategory = "all"): Promise<{
    items: NotificationItem[];
    unreadCount: number;
    totalCount: number;
  }> {
    const where: Record<string, unknown> = { userId };

    if (category === "unread") {
      where.readAt = null;
    } else if (category !== "all") {
      const types = CATEGORY_TYPE_MAP[category];
      if (types) {
        where.type = { in: types };
      }
    }

    const [rows, unreadCount, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.notification.count({
        where: { userId, readAt: null },
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return {
      items: rows.map(buildItem),
      unreadCount,
      totalCount,
    };
  },

  /**
   * Mark one notification as read. Ownership verified: the query is
   * scoped by `userId`. Foreign `notificationId` → 404.
   */
  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Notification not found");
    }
    if (!existing.readAt) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
      await auditLog.record({
        userId,
        action: "notification.marked_read",
        entity: "Notification",
        entityId: notificationId,
      });
    }
    return true;
  },

  /**
   * Mark ALL unread notifications as read. Scoped by `userId`.
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count > 0) {
      await auditLog.record({
        userId,
        action: "notification.marked_all_read",
        entity: "Notification",
        newValue: { count: result.count },
      });
    }
    return result.count;
  },
};
