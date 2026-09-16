import { ok, handleApiError } from "@/lib/api";
import { getActiveMaintenance } from "@/lib/system/maintenance";

export const dynamic = "force-dynamic";

/**
 * GET /api/maintenance/status
 *
 * Public endpoint — returns the current maintenance status so client-side
 * code (e.g. the support widget, student portal) can check whether
 * maintenance is active without needing admin permissions.
 */
export async function GET() {
  try {
    const status = await getActiveMaintenance();
    return ok(status);
  } catch (err) {
    return handleApiError(err);
  }
}
