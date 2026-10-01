import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { testProviderConnection } from "@/lib/ai/control-center";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai/providers/[id]/test
 * Tests the connection to an AI provider with a real authenticated request.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const result = await testProviderConnection(id, body.model);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
