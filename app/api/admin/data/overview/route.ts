import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getDataOverview } from "@/lib/services/data-export";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/data/overview
 *
 * Returns record counts for all major SVMS modules. Used by the
 * Data Management admin page to show an overview of system data.
 */
export async function GET() {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const overview = await getDataOverview();
    return ok(overview);
  } catch (err) {
    return handleApiError(err);
  }
}
