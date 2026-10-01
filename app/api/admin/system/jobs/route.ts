import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getJobsStatus } from "@/lib/system/jobs";

/**
 * GET /api/admin/system/jobs
 * Lists known cron jobs + their last-run status.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("system.read");
    if (g.error) return g.error;

    const jobs = await getJobsStatus();
    return ok({ jobs });
  } catch (err) {
    return handleApiError(err);
  }
}
