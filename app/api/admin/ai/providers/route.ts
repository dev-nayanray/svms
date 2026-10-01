import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { listProviders, createProvider, updateProvider, deleteProvider } from "@/lib/ai/control-center";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "openai-compatible"]),
  name: z.string().min(1).max(100),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  defaultModel: z.string().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  maxRequestsPerHour: z.number().int().min(1).optional(),
});

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
 * GET /api/admin/ai/providers
 * Returns all configured AI providers (API keys masked).
 */
export async function GET() {
  try {
    const g = await guard("system.read");
    if (g.error) return g.error;
    const providers = await listProviders();
    return ok({ providers });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/admin/ai/providers
 * Create a new AI provider.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid provider config", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const ctx = auditLog.fromRequest(req);
    const provider = await createProvider({
      ...parsed.data,
      baseUrl: parsed.data.baseUrl || undefined,
      actorId: g.user.id,
    });
    return ok({ provider }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/ai/providers (bulk — for updates by ID in body)
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const { id, ...updates } = body as { id?: string } & z.infer<typeof updateSchema>;
    if (!id) return fail("VALIDATION_ERROR", "Provider ID is required", 422);
    const parsed = updateSchema.safeParse(updates);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid provider config", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const provider = await updateProvider(id, parsed.data, g.user.id);
    return ok({ provider });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/ai/providers?id=<id>
 */
export async function DELETE(req: NextRequest) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("VALIDATION_ERROR", "Provider ID is required", 422);
    await deleteProvider(id, g.user.id);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
