import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getCounselorWorkload } from "@/lib/services/counselor-assignment";

/**
 * GET /api/admin/counselors
 * Returns counselor workload data for the admin lead panel.
 * Shows active lead count + total leads per counselor.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const counselors = await getCounselorWorkload();
    return ok({ counselors });
  } catch (err) {
    return handleApiError(err);
  }
}
