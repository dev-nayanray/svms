import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getAuditSummary } from "@/lib/system/logs";

/**
 * GET /api/admin/system/logs/summary
 * Returns a summary of audit log activity (today, last 7d, top actions).
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("audit_logs.read");
    if (g.error) return g.error;
    const summary = await getAuditSummary();
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
