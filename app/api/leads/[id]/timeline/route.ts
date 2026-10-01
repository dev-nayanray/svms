import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { leadService } from "@/lib/services/lead";

/**
 * GET /api/leads/[id]/timeline
 * Returns the activity timeline for a lead.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("leads.read");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    const timeline = await leadService.getTimeline(id);
    return ok({ data: timeline });
  } catch (err) {
    return handleApiError(err);
  }
}
