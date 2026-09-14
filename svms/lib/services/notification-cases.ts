import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

/**
 * Employee Notification Center service.
 *
 * ── IDOR closure ──────────────────────────────────────────────────────
 * Every read/write function embeds `notificationScope(scope)` in the
 * Prisma `where` clause. Notifications are addressed to a `userId` — the
 * caller's session user id — never to a client-supplied id. An EMPLOYEE
 * can only see / mutate their own notifications. ADMIN sees only their own
 * too (notifications are personal, not global).
 *
 * ── Type catalog ──────────────────────────────────────────────────────
 * Notification `type` strings are produced by services across the app
 * (application-cases, task-cases, document-cases, etc.). The catalog
 * below groups them into 9 categories the UI uses for filtering +
 * grouping. Each category carries an icon name and a display label.
 *
 * ── Deduplication ────────────────────────────────────────────────────
 * `emitNotification()` collapses duplicate notifications of the same
 * (userId, type, entityId) within a 5-minute window by updating the
 * existing row's `message` and `createdAt` instead of inserting a new
 * row. This prevents the notification center from being flooded by
 * repeated stage changes or rapid-fire messages.
 *
 * ── Related entity ───────────────────────────────────────────────────
 * `entityType` + `entityId` let the UI show a "View X" link that opens
 * the authorized related resource. They are also used as the dedup key.
 */

// ─── Type catalog ─────────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = [
  "APPLICATION",
  "DOCUMENT",
  "TASK",
  "PAYMENT",
  "VISA",
  "MESSAGE",
  "APPOINTMENT",
  "INVOICE",
  "SYSTEM",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * Maps a notification `type` string to its UI category. Used by the page
 * to group notifications into sections, and by the filter dropdown.
 */
export const TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  APPLICATION_STAGE_CHANGED: "APPLICATION",
  APPLICATION_ASSIGNED: "APPLICATION",
  APPLICATION_DEADLINE: "APPLICATION",

  DOCUMENT_APPROVED: "DOCUMENT",
  DOCUMENT_REJECTED: "DOCUMENT",
  DOCUMENT_REUPLOAD_REQUESTED: "DOCUMENT",
  DOCUMENT_UPLOADED: "DOCUMENT",
  DOCUMENT_UNDER_REVIEW: "DOCUMENT",

  TASK_ASSIGNED: "TASK",
  TASK_COMPLETED: "TASK",
  TASK_REASSIGNED: "TASK",
  TASK_DUE_SOON: "TASK",
  TASK_OVERDUE: "TASK",

  PAYMENT_REFUNDED: "PAYMENT",
  PAYMENT_RECEIVED: "PAYMENT",
  PAYMENT_OVERDUE: "PAYMENT",

  VISA_STAGE_CHANGED: "VISA",
  VISA_DEADLINE: "VISA",

  MESSAGE_RECEIVED: "MESSAGE",

  APPOINTMENT_CREATED: "APPOINTMENT",
  APPOINTMENT_RESCHEDULED: "APPOINTMENT",
  APPOINTMENT_CANCELLED: "APPOINTMENT",
  APPOINTMENT_CONFIRMED: "APPOINTMENT",
  APPOINTMENT_REMINDER: "APPOINTMENT",

  INVOICE_ISSUED: "INVOICE",
  INVOICE_OVERDUE: "INVOICE",

  WELCOME: "SYSTEM",
  SYSTEM: "SYSTEM",
};

export const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; icon: string /* lucide icon name */ }
> = {
  APPLICATION: { label: "Applications", icon: "FolderKanban" },
  DOCUMENT: { label: "Documents", icon: "FileText" },
  TASK: { label: "Tasks", icon: "CheckSquare" },
  PAYMENT: { label: "Payments", icon: "CreditCard" },
  VISA: { label: "Visa", icon: "Stamp" },
  MESSAGE: { label: "Messages", icon: "MessageSquare" },
  APPOINTMENT: { label: "Appointments", icon: "CalendarClock" },
  INVOICE: { label: "Invoices", icon: "Receipt" },
  SYSTEM: { label: "System", icon: "Bell" },
};

export function categoryForType(type: string): NotificationCategory {
  return TYPE_TO_CATEGORY[type] ?? "SYSTEM";
}

// ─── Types ────────────────────────────────────────────────────────────

export type NotificationListFilters = {
  unreadOnly?: boolean;
  category?: NotificationCategory;
  type?: string;
};

export type NotificationRow = {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationListResult = {
  rows: NotificationRow[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type UnreadCountResult = {
  total: number;
  byCategory: Record<NotificationCategory, number>;
};

// ─── Scope ────────────────────────────────────────────────────────────

/**
 * Returns the Prisma `where` fragment that scopes Notification records to
 * the caller. Notifications are personal — both EMPLOYEE and ADMIN see
 * only their own (filtered by `userId = session.user.id`). The userId
 * NEVER comes from the client.
 */
export function notificationScope(scope: EmployeeScope): Record<string, unknown> {
  return { userId: scope.userId };
}

// ─── List ─────────────────────────────────────────────────────────────

export async function listNotifications(
  scope: EmployeeScope,
  params: { filters?: NotificationListFilters; page?: number; pageSize?: number } = {},
): Promise<NotificationListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 30));
  const filters = params.filters ?? {};
  const owner = notificationScope(scope);

  const where: Record<string, unknown> = { ...owner };
  if (filters.unreadOnly) where.readAt = null;
  if (filters.type) where.type = filters.type;
  if (filters.category) {
    const typesInCategory = Object.entries(TYPE_TO_CATEGORY)
      .filter(([, cat]) => cat === filters.category)
      .map(([t]) => t);
    where.type = { in: typesInCategory.length > 0 ? typesInCategory : ["__none__"] };
  }

  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, type: true, title: true, message: true, link: true,
        entityType: true, entityId: true, readAt: true, createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...owner, readAt: null } }),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r,
      category: categoryForType(r.type),
    })),
    total,
    unread,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ─── Unread count (badge) ────────────────────────────────────────────

export async function getUnreadCount(scope: EmployeeScope): Promise<UnreadCountResult> {
  const owner = notificationScope(scope);
  const grouped = await prisma.notification.groupBy({
    by: ["type"],
    where: { ...owner, readAt: null },
    _count: { _all: true },
  });

  const byCategory = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((c) => [c, 0]),
  ) as Record<NotificationCategory, number>;

  let total = 0;
  for (const g of grouped) {
    const cat = categoryForType(g.type);
    byCategory[cat] += g._count._all;
    total += g._count._all;
  }

  return { total, byCategory };
}

// ─── Recent (for the bell dropdown) ──────────────────────────────────

export async function getRecentNotifications(
  scope: EmployeeScope,
  limit = 5,
): Promise<NotificationRow[]> {
  const owner = notificationScope(scope);
  const clampedLimit = Math.min(20, Math.max(1, limit));
  const rows = await prisma.notification.findMany({
    where: owner,
    orderBy: { createdAt: "desc" },
    take: clampedLimit,
    select: {
      id: true, type: true, title: true, message: true, link: true,
      entityType: true, entityId: true, readAt: true, createdAt: true,
    },
  });
  return rows.map((r) => ({ ...r, category: categoryForType(r.type) }));
}

// ─── Mark read ────────────────────────────────────────────────────────

/**
 * Mark a single notification as read. IDOR: the notification must belong
 * to the caller's userId — the scope filter is applied to the update's
 * `where` clause, so a foreign id will match zero rows and we return 404.
 */
export async function markNotificationRead(
  scope: EmployeeScope,
  id: string,
): Promise<{ updated: number }> {
  const owner = notificationScope(scope);
  // Verify ownership first so we can return a clean 404.
  const existing = await prisma.notification.findFirst({
    where: { id, ...owner },
    select: { id: true, readAt: true },
  });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Notification not found");
  }
  if (existing.readAt) {
    return { updated: 0 }; // already read — no-op
  }
  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  return { updated: 1 };
}

/**
 * Mark all of the caller's unread notifications as read. Optional
 * category filter for "mark all in this section as read".
 */
export async function markAllNotificationsRead(
  scope: EmployeeScope,
  opts: { category?: NotificationCategory } = {},
): Promise<{ updated: number }> {
  const owner = notificationScope(scope);
  const where: Record<string, unknown> = { ...owner, readAt: null };
  if (opts.category) {
    const typesInCategory = Object.entries(TYPE_TO_CATEGORY)
      .filter(([, cat]) => cat === opts.category)
      .map(([t]) => t);
    where.type = { in: typesInCategory.length > 0 ? typesInCategory : ["__none__"] };
  }
  const result = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

// ─── Emit (helper used by other services) ────────────────────────────

/**
 * Create a notification, with deduplication.
 *
 * If a notification with the same (userId, type, entityId) already exists
 * and was created within the last `dedupWindowMs` milliseconds, we update
 * that row's `message`, `createdAt`, and reset `readAt` to null instead
 * of inserting a new row. This collapses burst events (e.g. rapid message
 * arrivals or repeated stage changes on the same entity).
 *
 * If `entityId` is null/undefined, dedup is skipped and a new row is always
 * inserted.
 *
 * Best-effort: never throws — notification failures should not block the
 * caller's primary operation. Errors are logged and swallowed.
 */
export async function emitNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  dedupWindowMs?: number;
}): Promise<{ id: string; deduplicated: boolean }> {
  const dedupWindowMs = input.dedupWindowMs ?? 5 * 60 * 1000; // 5 min default
  const since = new Date(Date.now() - dedupWindowMs);

  try {
    // Try to find an existing notification to dedup against.
    if (input.entityId) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          entityId: input.entityId,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.notification.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            message: input.message,
            link: input.link ?? null,
            readAt: null, // re-mark as unread since the underlying entity changed
            createdAt: new Date(), // bump to top of list
          },
        });
        return { id: existing.id, deduplicated: true };
      }
    }

    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      select: { id: true },
    });
    return { id: created.id, deduplicated: false };
  } catch (err) {
    console.error("[notification-emit] failed", err);
    // Return a synthetic id so callers don't crash. The notification was
    // not persisted, but the primary operation continues.
    return { id: "", deduplicated: false };
  }
}
