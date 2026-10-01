import { prisma } from "@/lib/db";
import { getActiveMaintenance } from "@/lib/system/maintenance";

/**
 * Maintenance check helpers — used by API routes + server components
 * to short-circuit operations during maintenance.
 *
 * Middleware-level enforcement is intentionally NOT added here because
 * Next.js middleware runs at the edge and can't query MongoDB. Instead:
 *  - API routes check `requireNotMaintenance()` before mutating
 *  - Server components check `getActiveMaintenance()` and render the
 *    maintenance page instead of normal content
 */

export type MaintenanceInfo = {
  active: boolean;
  message: string;
  allowAdminAccess: boolean;
  expectedEndAt: string | null;
};

/**
 * Returns 503-compatible JSON for maintenance mode.
 * Used by API routes that detect maintenance is active.
 */
export function maintenanceResponse(info: { message: string }) {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "MAINTENANCE_MODE",
        message: info.message,
      },
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "300", // 5 minutes
      },
    },
  );
}

/**
 * Helper for API routes: returns null if maintenance is off, or
 * a 503 Response if maintenance is on and the user is not an admin.
 *
 * Usage:
 *   const maintenance = await requireNotMaintenance(req);
 *   if (maintenance) return maintenance;
 */
export async function requireNotMaintenance(
  userRole: string | undefined,
): Promise<Response | null> {
  try {
    const count = await prisma.maintenanceWindow.count({
      where: { enabled: true, endedAt: null },
    });
    if (count === 0) return null;

    // Maintenance is on — admins are allowed through if configured.
    const status = await getActiveMaintenance();
    if (userRole === "ADMIN" && status.allowAdminAccess) return null;

    return maintenanceResponse({ message: status.message });
  } catch {
    // DB error — fail open for availability
    return null;
  }
}

void getActiveMaintenance; // re-exported above implicitly via the import
