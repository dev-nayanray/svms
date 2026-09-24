import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { listSystemLogs } from "@/lib/system/logs";

/**
 * GET /api/admin/system/logs
 * Returns paginated system logs (SecurityEvent rows) with filters.
 *
 * Filters (query params):
 *   - type: backup | restore | verify | cron | auth | security | ...
 *   - severity: DEBUG | INFO | WARNING | ERROR | CRITICAL
 *   - resolved: OPEN | ACKNOWLEDGED | RESOLVED
 *   - dateFrom, dateTo (ISO)
 *   - search (case-insensitive contains on description)
 *   - page, pageSize (default 25, max 100)
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("system.logs.read");
    if (g.error) return g.error;
    const result = await listSystemLogs(req.nextUrl.searchParams);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
