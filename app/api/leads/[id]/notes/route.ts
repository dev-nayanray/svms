import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { leadService } from "@/lib/services/lead";
import { z } from "zod";

const noteSchema = z.object({
  note: z.string().min(1).max(2000),
});

/**
 * POST /api/leads/[id]/notes
 * Add a note to a lead (recorded in the activity timeline).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Note text is required", 422);
    }
    const result = await leadService.addNote(id, parsed.data.note, g.user);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
