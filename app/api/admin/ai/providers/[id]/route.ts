import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getProvider, updateProvider, deleteProvider } from "@/lib/ai/control-center";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  defaultModel: z.string().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  maxRequestsPerHour: z.number().int().min(1).optional(),
});

/**
 * GET /api/admin/ai/providers/[id]
 * Returns a single AI provider (API key masked).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("system.read");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    const provider = await getProvider(id);
    if (!provider) return fail("NOT_FOUND", "Provider not found", 404);
    return ok({ provider });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/ai/providers/[id]
 * Update a single AI provider.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid provider config", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const auditCtx = auditLog.fromRequest(req);
    const provider = await updateProvider(id, parsed.data, g.user.id);
    return ok({ provider });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/ai/providers/[id]
 * Delete an AI provider.
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const { id } = await ctx.params;
    await deleteProvider(id, g.user.id);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
