import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { logSystemEvent } from "./logs";

/**
 * Maintenance Mode Service
 * =========================
 *
 * Allows an admin to put the application into maintenance mode.
 *
 * Behavior:
 *  - Public users see a maintenance page (rendered by app/maintenance/page.tsx
 *    when an active MaintenanceWindow exists).
 *  - Student/Employee operations that mutate data are blocked at the API
 *    layer (the middleware checks isActiveMaintenance()).
 *  - Admins can still access /admin/* when allowAdminAccess=true.
 *
 * Every enable / disable action is audited.
 */

export type MaintenanceStatus = {
  active: boolean;
  message: string;
  startedAt: string | null;
  expectedEndAt: string | null;
  allowAdminAccess: boolean;
  windowId: string | null;
};

/** Returns the active maintenance window (or null if none). */
export async function getActiveMaintenance(): Promise<MaintenanceStatus> {
  try {
    const row = await prisma.maintenanceWindow.findFirst({
      where: { enabled: true, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!row) {
      return {
        active: false,
        message: "",
        startedAt: null,
        expectedEndAt: null,
        allowAdminAccess: true,
        windowId: null,
      };
    }
    return {
      active: true,
      message: row.message,
      startedAt: row.startedAt.toISOString(),
      expectedEndAt: row.expectedEndAt?.toISOString() ?? null,
      allowAdminAccess: row.allowAdminAccess,
      windowId: row.id,
    };
  } catch {
    return {
      active: false,
      message: "",
      startedAt: null,
      expectedEndAt: null,
      allowAdminAccess: true,
      windowId: null,
    };
  }
}

/** Check (used by middleware / API routes to short-circuit). */
export async function isMaintenanceActive(): Promise<boolean> {
  try {
    const count = await prisma.maintenanceWindow.count({
      where: { enabled: true, endedAt: null },
    });
    return count > 0;
  } catch {
    return false;
  }
}

export async function enableMaintenance(input: {
  message: string;
  expectedEndAt?: Date;
  allowAdminAccess?: boolean;
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<MaintenanceStatus> {
  // End any existing window first (defensive — should never have >1).
  await prisma.maintenanceWindow.updateMany({
    where: { endedAt: null },
    data: { endedAt: new Date(), enabled: false },
  });

  const row = await prisma.maintenanceWindow.create({
    data: {
      enabled: true,
      message: input.message,
      expectedEndAt: input.expectedEndAt ?? null,
      allowAdminAccess: input.allowAdminAccess ?? true,
      createdById: input.actorId,
    },
  });

  await auditLog.record({
    userId: input.actorId,
    action: "maintenance.enabled",
    entity: "MaintenanceWindow",
    entityId: row.id,
    newValue: {
      message: input.message,
      expectedEndAt: input.expectedEndAt,
      allowAdminAccess: input.allowAdminAccess,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  await logSystemEvent(
    "WARNING",
    "system",
    `Maintenance mode enabled: ${input.message}`,
    { windowId: row.id, actorId: input.actorId },
  );

  return {
    active: true,
    message: row.message,
    startedAt: row.startedAt.toISOString(),
    expectedEndAt: row.expectedEndAt?.toISOString() ?? null,
    allowAdminAccess: row.allowAdminAccess,
    windowId: row.id,
  };
}

export async function disableMaintenance(actorId: string): Promise<void> {
  const active = await prisma.maintenanceWindow.findFirst({
    where: { enabled: true, endedAt: null },
  });
  if (!active) return;

  await prisma.maintenanceWindow.update({
    where: { id: active.id },
    data: { enabled: false, endedAt: new Date() },
  });

  await auditLog.record({
    userId: actorId,
    action: "maintenance.disabled",
    entity: "MaintenanceWindow",
    entityId: active.id,
    oldValue: { message: active.message },
  });

  await logSystemEvent(
    "INFO",
    "system",
    `Maintenance mode disabled (was started ${active.startedAt.toISOString()})`,
    { windowId: active.id, actorId },
  );
}
