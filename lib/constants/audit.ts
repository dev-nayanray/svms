/**
 * Pure helpers for the Admin Audit Log module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The where-builder, entity-type catalog, and action-grouping
 * metadata are the single source of truth.
 *
 * Security: audit records are immutable — there is no PATCH or DELETE
 * endpoint for AuditLog. The records can only be created via
 * `auditLog.record()` from the service layer. Financial, security, and
 * permission-related actions are always auditable (enforced by the
 * service layer in each module's API routes).
 */

/** Entity types that have per-entity audit timelines in the admin UI. */
export const AUDIT_ENTITY_TYPES = [
  "Student",
  "Application",
  "Payment",
  "Invoice",
  "Document",
  "Employee",
  "University",
  "Course",
  "Country",
  "Branch",
  "VisaApplication",
  "VisaRequirement",
  "DocumentRequirement",
  "Task",
  "Notification",
  "Conversation",
  "Message",
  "Lead",
  "Intake",
  "CounselingRequest",
  "SystemSetting",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Student: "Students",
  Application: "Applications",
  Payment: "Payments",
  Invoice: "Invoices",
  Document: "Documents",
  Employee: "Employees",
  University: "Universities",
  Course: "Courses",
  Country: "Countries",
  Branch: "Branches",
  VisaApplication: "Visa Applications",
  VisaRequirement: "Visa Requirements",
  DocumentRequirement: "Document Requirements",
  Task: "Tasks",
  Notification: "Notifications",
  Conversation: "Conversations",
  Message: "Messages",
  Lead: "Leads",
  Intake: "Intakes",
  CounselingRequest: "Counseling Requests",
  SystemSetting: "System Settings",
};

/**
 * Action categories for grouping in the UI filter.
 */
export const AUDIT_ACTION_CATEGORIES = [
  { key: "created", label: "Created", pattern: /\.created$/ },
  { key: "updated", label: "Updated", pattern: /\.updated$/ },
  { key: "deleted", label: "Deleted/Archived", pattern: /\.(deleted|archived)$/ },
  { key: "status", label: "Status Changes", pattern: /\.status_changed$/ },
  { key: "stage", label: "Stage Changes", pattern: /\.(stage_changed|assigned|unarchived)$/ },
  { key: "review", label: "Document Review", pattern: /\.(approved|rejected|under_review|reupload_requested)$/ },
  { key: "finance", label: "Finance", pattern: /\.(recorded|refunded|paid)$/ },
  { key: "auth", label: "Auth & Settings", pattern: /\.(registered|login|setting\.)/ },
] as const;

/**
 * Build a Prisma `where` fragment for the admin audit log list. Supports
 * filtering by userId, action, entity, entityId, and date range. All
 * filters are AND-combined and applied server-side.
 */
export function buildAuditWhere(filters: {
  search?: string;
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [];

  if (filters.userId) {
    andClauses.push({ userId: filters.userId });
  }
  if (filters.action) {
    andClauses.push({ action: { contains: filters.action, mode: "insensitive" } });
  }
  if (filters.entity) {
    andClauses.push({ entity: filters.entity });
  }
  if (filters.entityId) {
    andClauses.push({ entityId: filters.entityId });
  }

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, unknown> = {};
    if (filters.dateFrom) range.gte = filters.dateFrom;
    if (filters.dateTo) range.lte = filters.dateTo;
    andClauses.push({ createdAt: range });
  }

  if (search) {
    andClauses.push({
      OR: [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  return andClauses.length > 0 ? { AND: andClauses } : {};
}

/**
 * Format a JSON value for display in the audit log table. Returns a
 * truncated string for long values, "null" for null, and "—" for
 * undefined.
 */
export function formatJsonValue(value: unknown, maxLength = 200): string {
  if (value == null) return "—";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

/**
 * Returns true if the given action is security-sensitive (financial,
 * security, or permission-related). These actions must always be
 * auditable — the service layer in each module's API route enforces
 * this by calling `auditLog.record()`.
 */
export function isSecuritySensitiveAction(action: string): boolean {
  const patterns = [
    /payment\./,
    /invoice\./,
    /finance\./,
    /setting\./,
    /employee\.(created|updated|role_assigned|access_reset)/,
    /branch\./,
    /role\./,
    /permission\./,
  ];
  return patterns.some((p) => p.test(action));
}
