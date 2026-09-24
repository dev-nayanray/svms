import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { runHealthChecks } from "@/lib/system/health";

/**
 * GET /api/admin/system/health
 * Returns the current health report (runs checks live).
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("system.health.read");
    if (g.error) return g.error;

    const report = await runHealthChecks();
    return ok(report);
  } catch (err) {
    return handleApiError(err);
  }
}
