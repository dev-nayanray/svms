import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { leadService } from "@/lib/services/lead";
import { z } from "zod";

const assignSchema = z.object({
  counselorId: z.string().min(1),
});

/**
 * POST /api/leads/[id]/assign
 * Manually assign a counselor to a lead.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "counselorId is required", 422);
    }
    const result = await leadService.assign(id, parsed.data.counselorId, g.user);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
