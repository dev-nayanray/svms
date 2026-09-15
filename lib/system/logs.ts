import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { isEnvConfigured } from "./env";

/**
 * System Logs Service
 * ===================
 *
 * Provides a unified view of operational events from:
 *  - AuditLog (admin actions)
 *  - SecurityEvent (security incidents)
 *  - BackupRecord (backup/restore lifecycle)
 *  - StoredFile (upload lifecycle, indirectly)
 *
 * Plus a structured `logSystemEvent()` helper that persists a
 * SecurityEvent (for security/incident tracking) without duplicating
 * the AuditLog (which is for admin actions specifically).
 *
 * All list queries are server-side paginated to avoid loading the
 * full log into the browser.
 */

export type SystemLogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type SystemLogModule =
  | "backup"
  | "restore"
  | "verify"
  | "cron"
  | "auth"
  | "security"
  | "config"
  | "storage"
  | "email"
  | "api"
  | "system";

/** Record a security/operational event. Used by all system services. */
export async function logSystemEvent(
  severity: SystemLogLevel,
  module: SystemLogModule,
  description: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        type: module,
        severity,
        description,
        metadata: metadata as never,
      },
    });
  } catch {
    // best-effort — never throw from logging
  }
}

export type LogFilter = {
  search?: string;
  type?: string;
  severity?: string;
  resolved?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type LogListResult = {
  data: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    resolved: string;
    ipAddress: string | null;
    resource: string | null;
    createdAt: string;
    metadata: unknown;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  types: string[];
  severities: string[];
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listSystemLogs(
  sp: URLSearchParams,
): Promise<LogListResult> {
  const page = Math.max(Number(sp.get("page") ?? 1), 1);
  const pageSize = Math.min(Number(sp.get("pageSize") ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const where: Record<string, unknown> = {};
  const type = sp.get("type");
  const severity = sp.get("severity");
  const resolved = sp.get("resolved");
  const search = sp.get("search")?.trim();
  const dateFrom = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : undefined;
  const dateTo = sp.get("dateTo") ? new Date(sp.get("dateTo")!) : undefined;

  if (type) where.type = type;
  if (severity) where.severity = severity;
  if (resolved) where.resolved = resolved;
  if (dateFrom || dateTo) {
    const range: Record<string, unknown> = {};
    if (dateFrom) range.gte = dateFrom;
    if (dateTo) range.lte = dateTo;
    where.createdAt = range;
  }
  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }

  const [data, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.securityEvent.count({ where }),
  ]);

  return {
    data: data.map((d) => ({
      id: d.id,
      type: d.type,
      severity: d.severity,
      description: d.description,
      resolved: d.resolved,
      ipAddress: d.ipAddress,
      resource: d.resource,
      createdAt: d.createdAt.toISOString(),
      metadata: d.metadata,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
    types: [
      "backup",
      "restore",
      "verify",
      "cron",
      "auth",
      "security",
      "config",
      "storage",
      "email",
      "api",
      "system",
    ],
    severities: ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
  };
}

/** Mark a security event as acknowledged/resolved (admin only). */
export async function resolveSecurityEvent(
  id: string,
  actorId: string,
  resolution: "ACKNOWLEDGED" | "RESOLVED",
): Promise<void> {
  await prisma.securityEvent.update({
    where: { id },
    data: { resolved: resolution, resolvedById: actorId, resolvedAt: new Date() },
  });
  await auditLog.record({
    userId: actorId,
    action: "security_event.resolved",
    entity: "SecurityEvent",
    entityId: id,
    newValue: { resolution },
  });
}

// ─── Recent activity helper for the overview dashboard ──────────

export async function getRecentFailedLogins(_limit = 5): Promise<number> {
  try {
    return await prisma.securityEvent.count({
      where: {
        type: "auth",
        severity: { in: ["WARNING", "CRITICAL"] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
  } catch {
    return 0;
  }
}

export async function getPendingSecurityEvents(): Promise<number> {
  try {
    return await prisma.securityEvent.count({
      where: { resolved: "OPEN", severity: { in: ["HIGH", "CRITICAL"] } },
    });
  } catch {
    return 0;
  }
}

// ─── Audit log summary (admin audit tab) ────────────────────────

export async function getAuditSummary(): Promise<{
  totalToday: number;
  totalLast7d: number;
  topActions: Array<{ action: string; count: number }>;
}> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalToday, totalLast7d, recentActions] = await Promise.all([
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { action: true },
        take: 500,
      }),
    ]);

    const counts = new Map<string, number>();
    for (const a of recentActions) {
      counts.set(a.action, (counts.get(a.action) ?? 0) + 1);
    }
    const topActions = Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { totalToday, totalLast7d, topActions };
  } catch {
    return { totalToday: 0, totalLast7d: 0, topActions: [] };
  }
}

// Used by tests to clear the log between runs
export async function __clearSystemLogsForTests(): Promise<void> {
  if (process.env.NODE_ENV !== "test") return;
  try {
    await prisma.securityEvent.deleteMany({});
  } catch {
    // ignore
  }
}

void isEnvConfigured; // silence unused import warning if env not needed elsewhere here
