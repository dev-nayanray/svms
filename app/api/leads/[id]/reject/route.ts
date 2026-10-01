import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { leadService } from "@/lib/services/lead";

/**
 * POST /api/leads/[id]/reject
 * Reject a lead (PENDING_REVIEW → REJECTED).
 *
 * Body:
 *   - reason?: string
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const result = await leadService.reject(id, g.user, body.reason);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
