/**
 * Pure helpers for the Admin Notification & Messaging module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The notification type catalog, read-status filters, and
 * conversation helpers are the single source of truth.
 *
 * Security: internal notes (visibility: "INTERNAL") are never exposed
 * to students. The message visibility field is enforced server-side
 * in every conversation/message API route.
 */

export const NOTIFICATION_TYPES = [
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
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  DOCUMENT_UPLOADED: "Document Uploaded",
  DOCUMENT_APPROVED: "Document Approved",
  DOCUMENT_REJECTED: "Document Rejected",
  DOCUMENT_REUPLOAD_REQUESTED: "Re-upload Requested",
  APPLICATION_STAGE_CHANGED: "Application Stage Changed",
  TASK_ASSIGNED: "Task Assigned",
  TASK_COMPLETED: "Task Completed",
  TASK_CANCELLED: "Task Cancelled",
  PAYMENT_RECORDED: "Payment Recorded",
  PAYMENT_DUE: "Payment Due",
  VISA_STAGE_CHANGED: "Visa Status Changed",
  COUNSELING_REQUEST: "Counseling Request",
  NEW_MESSAGE: "New Message",
};

/** Icon name (lucide-react) for each notification type. */
export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  DOCUMENT_UPLOADED: "FileText",
  DOCUMENT_APPROVED: "CheckCircle2",
  DOCUMENT_REJECTED: "XCircle",
  DOCUMENT_REUPLOAD_REQUESTED: "RotateCcw",
  APPLICATION_STAGE_CHANGED: "FolderKanban",
  TASK_ASSIGNED: "CheckSquare",
  TASK_COMPLETED: "CheckCircle2",
  TASK_CANCELLED: "XCircle",
  PAYMENT_RECORDED: "DollarSign",
  PAYMENT_DUE: "AlertTriangle",
  VISA_STAGE_CHANGED: "Stamp",
  COUNSELING_REQUEST: "MessageCircle",
  NEW_MESSAGE: "MessageSquare",
};

/** Read-status filter values for the notification center. */
export const NOTIFICATION_READ_FILTERS = ["all", "unread", "read"] as const;
export type NotificationReadFilter = (typeof NOTIFICATION_READ_FILTERS)[number];

export const NOTIFICATION_READ_FILTER_LABELS: Record<NotificationReadFilter, string> = {
  all: "All",
  unread: "Unread",
  read: "Read",
};

/** Message visibility — controls who can see a message. */
export const MESSAGE_VISIBILITIES = ["INTERNAL", "STUDENT"] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export const MESSAGE_VISIBILITY_LABELS: Record<MessageVisibility, string> = {
  INTERNAL: "Internal (staff only)",
  STUDENT: "Student-visible",
};

/**
 * Returns true if a message with the given visibility should be visible
 * to the given role. Internal notes are never exposed to students.
 */
export function isMessageVisibleTo(
  visibility: string,
  role: string,
): boolean {
  if (visibility === "INTERNAL") {
    return role === "ADMIN" || role === "EMPLOYEE";
  }
  // STUDENT visibility — all roles can see it
  return true;
}

/**
 * Build a Prisma `where` fragment for the notification list based on
 * the read-status filter.
 */
export function buildNotificationWhere(filters: {
  userId: string;
  readFilter?: NotificationReadFilter;
  search?: string;
}): Record<string, unknown> {
  const andClauses: Record<string, unknown>[] = [{ userId: filters.userId }];

  if (filters.readFilter === "unread") {
    andClauses.push({ readAt: null });
  } else if (filters.readFilter === "read") {
    andClauses.push({ readAt: { not: null } });
  }

  const search = filters.search?.trim();
  if (search) {
    andClauses.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
        { type: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  return { AND: andClauses };
}

/**
 * Build a Prisma `where` fragment for the conversation list based on
 * the search term.
 */
export function buildConversationWhere(filters: {
  search?: string;
  employeeId?: string;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [];

  if (filters.employeeId) {
    andClauses.push({ employeeId: filters.employeeId });
  }

  if (search) {
    andClauses.push({
      OR: [
        { student: { firstName: { contains: search, mode: "insensitive" } } },
        { student: { lastName: { contains: search, mode: "insensitive" } } },
        { student: { studentId: { contains: search, mode: "insensitive" } } },
        { employee: { user: { name: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }

  return andClauses.length > 0 ? { AND: andClauses } : {};
}
