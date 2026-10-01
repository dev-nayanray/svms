import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { leadService } from "@/lib/services/lead";

/**
 * POST /api/leads/[id]/approve
 * Approve a lead (PENDING_REVIEW → APPROVED).
 * Optionally auto-assign a counselor.
 *
 * Body:
 *   - autoAssign?: boolean (default: false)
 *   - strategy?: "ROUND_ROBIN" | "LEAST_LOAD" | "PROGRAM_MATCH"
 *   - counselorId?: string (for manual override)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const result = await leadService.approve(id, g.user, {
      autoAssign: body.autoAssign ?? false,
      strategy: body.strategy,
      counselorId: body.counselorId,
    });
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
