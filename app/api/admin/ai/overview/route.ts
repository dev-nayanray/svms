import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getAiOverview } from "@/lib/ai/control-center";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai/overview
 * Returns the AI control center dashboard data.
 */
export async function GET() {
  try {
    const g = await guard("system.read");
    if (g.error) return g.error;
    const overview = await getAiOverview();
    return ok(overview);
  } catch (err) {
    return handleApiError(err);
  }
}
