import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getSystemOverview } from "@/lib/system/overview";

/**
 * GET /api/admin/system
 * Returns the full System Administration overview payload.
 * Admin-only.
 */
export async function GET() {
  try {
    const g = await guard("system.read");
    if (g.error) return g.error;
    const overview = await getSystemOverview();
    return ok(overview);
  } catch (err) {
    return handleApiError(err);
  }
}
