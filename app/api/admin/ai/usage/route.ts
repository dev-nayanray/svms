import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getUsageStats } from "@/lib/ai/control-center";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai/usage?days=30
 * Returns AI usage statistics + cost tracking.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("system.read");
    if (g.error) return g.error;
    const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
    const stats = await getUsageStats(Math.min(days, 365));
    return ok(stats);
  } catch (err) {
    return handleApiError(err);
  }
}
