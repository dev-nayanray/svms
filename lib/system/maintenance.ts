import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { logSystemEvent } from "./logs";
import { revalidateMaintenance, revalidateMarketingPages } from "./revalidate";

/**
 * Maintenance Mode Service
 * =========================
 *
 * Allows an admin to put the application into maintenance mode.
 *
 * Behavior:
 *  - Public users see the maintenance page (rendered by the marketing
 *    layout when an active MaintenanceWindow exists).
 *  - Student/Employee operations that mutate data are blocked at the API
 *    layer via requireNotMaintenance().
 *  - Admins can still access /admin/* when allowAdminAccess=true.
 *
 * Every enable / disable / settings change is audited + revalidates the
 * public cache so the change appears immediately.
 */

export type MaintenanceStatus = {
  active: boolean;
  title: string;
  message: string;
  startedAt: string | null;
  expectedEndAt: string | null;
  allowAdminAccess: boolean;
  showContactButton: boolean;
  contactButtonText: string;
  contactButtonUrl: string;
  showSocialLinks: boolean;
  windowId: string | null;
};

const INACTIVE_STATUS: MaintenanceStatus = {
  active: false,
  title: "",
  message: "",
  startedAt: null,
  expectedEndAt: null,
  allowAdminAccess: true,
  showContactButton: true,
  contactButtonText: "Contact Support",
  contactButtonUrl: "/contact",
  showSocialLinks: true,
  windowId: null,
};

/**
 * Check if a scheduled maintenance window should be active now.
 * If scheduledStartAt is in the past AND scheduledEndAt is in the future
 * (or not set), the window is active.
 */
function isScheduledActive(now: Date, start?: Date | null, end?: Date | null): boolean {
  if (!start) return true; // no schedule = immediate
  if (now < start) return false; // not started yet
  if (end && now > end) return false; // already ended
  return true;
}

/**
 * Auto-deactivate maintenance windows whose scheduled end has passed.
 * Called on every getActiveMaintenance() check.
 */
async function autoDeactivateExpired(): Promise<void> {
  try {
    const now = new Date();
    const expired = await prisma.maintenanceWindow.findMany({
      where: {
        enabled: true,
        endedAt: null,
        scheduledEndAt: { lt: now },
      },
    });
    for (const w of expired) {
      await prisma.maintenanceWindow.update({
        where: { id: w.id },
        data: { enabled: false, endedAt: now },
      });
    }
  } catch {
    // best-effort
  }
}

/** Returns the active maintenance window (or inactive status if none). */
export async function getActiveMaintenance(): Promise<MaintenanceStatus> {
  try {
    // Auto-deactivate expired scheduled windows
    await autoDeactivateExpired();

    const row = await prisma.maintenanceWindow.findFirst({
      where: { enabled: true, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!row) return INACTIVE_STATUS;

    // Check if this is a scheduled window that hasn't started yet
    if (row.scheduledStartAt && !isScheduledActive(new Date(), row.scheduledStartAt, row.scheduledEndAt)) {
      return INACTIVE_STATUS;
    }

    return {
      active: true,
      title: row.title || "We'll be back soon",
      message: row.message,
      startedAt: row.startedAt.toISOString(),
      expectedEndAt: row.expectedEndAt?.toISOString() ?? null,
      allowAdminAccess: row.allowAdminAccess,
      showContactButton: row.showContactButton,
      contactButtonText: row.contactButtonText || "Contact Support",
      contactButtonUrl: row.contactButtonUrl || "/contact",
      showSocialLinks: row.showSocialLinks,
      windowId: row.id,
    };
  } catch {
    return INACTIVE_STATUS;
  }
}

/** Check (used by middleware / API routes to short-circuit). */
export async function isMaintenanceActive(): Promise<boolean> {
  const status = await getActiveMaintenance();
  return status.active;
}

export type EnableMaintenanceInput = {
  message: string;
  title?: string;
  expectedEndAt?: Date;
  allowAdminAccess?: boolean;
  showContactButton?: boolean;
  contactButtonText?: string;
  contactButtonUrl?: string;
  showSocialLinks?: boolean;
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function enableMaintenance(input: EnableMaintenanceInput): Promise<MaintenanceStatus> {
  // End any existing window first (defensive — should never have >1).
  await prisma.maintenanceWindow.updateMany({
    where: { endedAt: null },
    data: { endedAt: new Date(), enabled: false },
  });

  const row = await prisma.maintenanceWindow.create({
    data: {
      enabled: true,
      message: input.message,
      title: input.title ?? "We'll be back soon",
      expectedEndAt: input.expectedEndAt ?? null,
      allowAdminAccess: input.allowAdminAccess ?? true,
      showContactButton: input.showContactButton ?? true,
      contactButtonText: input.contactButtonText ?? "Contact Support",
      contactButtonUrl: input.contactButtonUrl ?? "/contact",
      showSocialLinks: input.showSocialLinks ?? true,
      scheduledStartAt: input.scheduledStartAt ?? null,
      scheduledEndAt: input.scheduledEndAt ?? null,
      createdById: input.actorId,
    },
  });

  await auditLog.record({
    userId: input.actorId,
    action: "maintenance.enabled",
    entity: "MaintenanceWindow",
    entityId: row.id,
    newValue: {
      title: row.title,
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

  // Revalidate the public cache so the maintenance page appears immediately
  revalidateMaintenance();
  revalidateMarketingPages();

  return {
    active: true,
    title: row.title,
    message: row.message,
    startedAt: row.startedAt.toISOString(),
    expectedEndAt: row.expectedEndAt?.toISOString() ?? null,
    allowAdminAccess: row.allowAdminAccess,
    showContactButton: row.showContactButton,
    contactButtonText: row.contactButtonText,
    contactButtonUrl: row.contactButtonUrl,
    showSocialLinks: row.showSocialLinks,
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

  // Revalidate so the public site returns to normal immediately
  revalidateMaintenance();
  revalidateMarketingPages();
}

/**
 * Update maintenance settings (title, message, contact button, etc.)
 * on the ACTIVE window. If no window is active, this is a no-op.
 */
export async function updateMaintenanceSettings(
  input: Partial<EnableMaintenanceInput>,
  actorId: string,
): Promise<MaintenanceStatus> {
  const active = await prisma.maintenanceWindow.findFirst({
    where: { enabled: true, endedAt: null },
  });
  if (!active) return INACTIVE_STATUS;

  await prisma.maintenanceWindow.update({
    where: { id: active.id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.message !== undefined && { message: input.message }),
      ...(input.expectedEndAt !== undefined && { expectedEndAt: input.expectedEndAt }),
      ...(input.allowAdminAccess !== undefined && { allowAdminAccess: input.allowAdminAccess }),
      ...(input.showContactButton !== undefined && { showContactButton: input.showContactButton }),
      ...(input.contactButtonText !== undefined && { contactButtonText: input.contactButtonText }),
      ...(input.contactButtonUrl !== undefined && { contactButtonUrl: input.contactButtonUrl }),
      ...(input.showSocialLinks !== undefined && { showSocialLinks: input.showSocialLinks }),
    },
  });

  await auditLog.record({
    userId: actorId,
    action: "maintenance.settings_updated",
    entity: "MaintenanceWindow",
    entityId: active.id,
    newValue: input,
  });

  revalidateMaintenance();
  revalidateMarketingPages();

  return getActiveMaintenance();
}
