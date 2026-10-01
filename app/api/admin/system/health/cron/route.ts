import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { runHealthChecks } from "@/lib/system/health";
import { recordJobRun } from "@/lib/system/jobs";
import { logSystemEvent } from "@/lib/system/logs";

/**
 * GET /api/admin/system/health/cron?job=health-check&token=<CRON_SECRET>
 *
 * Periodic health check (every 15 min). Persists results to
 * SystemHealthCheck for trend history.
 */
export async function GET(req: NextRequest) {
  try {
    const expectedToken = process.env.CRON_SECRET;
    if (expectedToken) {
      const authHeader = req.headers.get("authorization") ?? "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const queryToken = req.nextUrl.searchParams.get("token");
      const got = bearer ?? queryToken;
      if (got !== expectedToken) {
        return fail("UNAUTHORIZED", "Invalid cron token", 401);
      }
    } else if (process.env.NODE_ENV === "production") {
      return fail("INTERNAL_ERROR", "CRON_SECRET not configured", 500);
    }

    const start = Date.now();
    const report = await runHealthChecks();
    const latencyMs = Date.now() - start;

    // Map overall → health status
    const status = report.overall === "healthy" ? "healthy" : report.overall === "warning" ? "warning" : "critical";
    await recordJobRun("health-check", status, `Overall: ${report.overall}`, latencyMs);
    await logSystemEvent("INFO", "cron", `Health check ran: ${report.overall}`, { latencyMs });

    return ok({ ran: true, overall: report.overall, latencyMs });
  } catch (err) {
    return handleApiError(err);
  }
}
