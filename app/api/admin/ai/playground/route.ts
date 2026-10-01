import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getProviderAdapter, type ProviderType, type ChatMessage } from "@/lib/ai/adapters/types";
import { logUsage } from "@/lib/ai/control-center";
import { z } from "zod";

export const dynamic = "force-dynamic";

const playgroundSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
});

/**
 * POST /api/admin/ai/playground
 *
 * AI Playground — lets admins test prompts against configured providers.
 * Makes a REAL API call to the provider (no mocks).
 *
 * Usage is logged for cost tracking.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;

    const body = await req.json();
    const parsed = playgroundSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid playground request", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }

    const provider = await prisma.aiProvider.findUnique({
      where: { id: parsed.data.providerId },
    });
    if (!provider) return fail("NOT_FOUND", "Provider not found", 404);
    if (!provider.enabled) return fail("BAD_REQUEST", "Provider is disabled", 400);
    if (!provider.apiKeyEncrypted) return fail("BAD_REQUEST", "Provider has no API key configured", 400);

    const adapter = getProviderAdapter(provider.provider as ProviderType);
    const messages: ChatMessage[] = parsed.data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await adapter.generate({
      apiKey: provider.apiKeyEncrypted,
      baseUrl: provider.baseUrl ?? undefined,
      options: {
        messages,
        model: parsed.data.model,
        temperature: parsed.data.temperature ?? 0.7,
        maxTokens: parsed.data.maxTokens ?? 1024,
        stream: false,
      },
    });

    // Calculate cost (in USD cents)
    const modelInfo = await prisma.aiModel.findFirst({
      where: { providerId: provider.id, modelId: parsed.data.model },
    });
    const inputCostCents = modelInfo?.inputPricePerMillionCents
      ? Math.ceil((result.usage.inputTokens / 1_000_000) * modelInfo.inputPricePerMillionCents)
      : 0;
    const outputCostCents = modelInfo?.outputPricePerMillionCents
      ? Math.ceil((result.usage.outputTokens / 1_000_000) * modelInfo.outputPricePerMillionCents)
      : 0;
    const totalCostCents = inputCostCents + outputCostCents;

    // Log usage for cost tracking
    await logUsage({
      providerId: provider.id,
      model: parsed.data.model,
      channel: "playground",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: result.latencyMs,
      status: "success",
      costCents: totalCostCents,
    });

    return ok({
      content: result.content,
      toolCalls: result.toolCalls,
      usage: result.usage,
      latencyMs: result.latencyMs,
      model: result.model,
      costCents: totalCostCents,
    });
  } catch (err) {
    // Log the error to usage tracking
    const message = err instanceof Error ? err.message : String(err);
    return handleApiError(new Error(`AI Playground error: ${message}`));
  }
}
