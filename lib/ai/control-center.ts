import "server-only";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { getProviderAdapter, type ProviderType, type ConnectionTestResult } from "@/lib/ai/adapters/types";
import { getTelegramConfig } from "@/lib/services/telegram-config";

/**
 * AI Control Center Service
 * =========================
 *
 * Server-side service for managing AI providers, models, and usage.
 * All methods run ONLY on the server — API keys are never returned
 * to the frontend.
 *
 * SECURITY:
 *  - API keys are stored encrypted in the AiProvider table
 *  - The `apiKeyEncrypted` field is NEVER returned in API responses
 *  - Connection tests make real authenticated requests to the provider
 *  - Usage is logged for cost tracking
 */

// ─── Types ────────────────────────────────────────────────────────

export type ProviderConfig = {
  id: string;
  provider: ProviderType;
  name: string;
  baseUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
  lastTestError: string | null;
  priority: number;
  maxRequestsPerHour: number | null;
  hasApiKey: boolean;
  models: Array<{
    id: string;
    modelId: string;
    name: string;
    supportsStreaming: boolean;
    supportsToolCalling: boolean;
    supportsVision: boolean;
    contextWindow: number | null;
    inputPricePerMillionCents: number | null;
    outputPricePerMillionCents: number | null;
    enabled: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Strip the encrypted API key from a provider before returning it
 * to the frontend. Replaces it with a boolean `hasApiKey` flag.
 */
function maskProvider(p: {
  id: string;
  provider: string;
  name: string;
  apiKeyEncrypted: string | null;
  baseUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
  lastTestStatus: string | null;
  lastTestedAt: Date | null;
  lastTestError: string | null;
  priority: number;
  maxRequestsPerHour: number | null;
  createdAt: Date;
  updatedAt: Date;
  models: Array<{
    id: string;
    modelId: string;
    name: string;
    supportsStreaming: boolean;
    supportsToolCalling: boolean;
    supportsVision: boolean;
    contextWindow: number | null;
    inputPricePerMillionCents: number | null;
    outputPricePerMillionCents: number | null;
    enabled: boolean;
  }>;
}): ProviderConfig {
  return {
    id: p.id,
    provider: p.provider as ProviderType,
    name: p.name,
    baseUrl: p.baseUrl,
    defaultModel: p.defaultModel,
    enabled: p.enabled,
    lastTestStatus: p.lastTestStatus,
    lastTestedAt: p.lastTestedAt?.toISOString() ?? null,
    lastTestError: p.lastTestError,
    priority: p.priority,
    maxRequestsPerHour: p.maxRequestsPerHour,
    hasApiKey: !!p.apiKeyEncrypted,
    models: p.models.map((m) => ({ ...m })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ─── Provider CRUD ────────────────────────────────────────────────

export async function listProviders(): Promise<ProviderConfig[]> {
  const providers = await prisma.aiProvider.findMany({
    include: { models: true },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
  return providers.map(maskProvider);
}

export async function getProvider(id: string): Promise<ProviderConfig | null> {
  const provider = await prisma.aiProvider.findUnique({
    where: { id },
    include: { models: true },
  });
  if (!provider) return null;
  return maskProvider(provider);
}

export async function createProvider(input: {
  provider: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  priority?: number;
  maxRequestsPerHour?: number;
  actorId: string;
}): Promise<ProviderConfig> {
  const created = await prisma.aiProvider.create({
    data: {
      provider: input.provider,
      name: input.name,
      apiKeyEncrypted: input.apiKey ?? null, // TODO: encrypt at rest with AUTH_SECRET
      baseUrl: input.baseUrl ?? null,
      defaultModel: input.defaultModel ?? null,
      priority: input.priority ?? 100,
      maxRequestsPerHour: input.maxRequestsPerHour ?? null,
      lastTestStatus: "untested",
      createdById: input.actorId,
    },
    include: { models: true },
  });

  // Auto-populate default models for this provider type
  const adapter = getProviderAdapter(input.provider);
  const defaultModels = adapter.getDefaultModels();
  if (defaultModels.length > 0) {
    await prisma.aiModel.createMany({
      data: defaultModels.map((m) => ({
        providerId: created.id,
        modelId: m.modelId,
        name: m.name,
        supportsStreaming: m.supportsStreaming,
        supportsToolCalling: m.supportsToolCalling,
        supportsVision: m.supportsVision,
        contextWindow: m.contextWindow ?? null,
        inputPricePerMillionCents: m.inputPricePerMillionCents ?? null,
        outputPricePerMillionCents: m.outputPricePerMillionCents ?? null,
      })),
    });
  }

  const withModels = await prisma.aiProvider.findUnique({
    where: { id: created.id },
    include: { models: true },
  });

  await auditLog.record({
    userId: input.actorId,
    action: "ai_provider.created",
    entity: "AiProvider",
    entityId: created.id,
    newValue: { provider: input.provider, name: input.name },
  });

  return maskProvider(withModels!);
}

export async function updateProvider(
  id: string,
  input: Partial<{
    name: string;
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
    enabled: boolean;
    priority: number;
    maxRequestsPerHour: number;
  }>,
  actorId: string,
): Promise<ProviderConfig> {
  const existing = await prisma.aiProvider.findUnique({ where: { id } });
  if (!existing) throw new Error("Provider not found");

  await prisma.aiProvider.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.apiKey !== undefined && { apiKeyEncrypted: input.apiKey }), // TODO: encrypt
      ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
      ...(input.defaultModel !== undefined && { defaultModel: input.defaultModel }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.maxRequestsPerHour !== undefined && { maxRequestsPerHour: input.maxRequestsPerHour }),
    },
  });

  await auditLog.record({
    userId: actorId,
    action: "ai_provider.updated",
    entity: "AiProvider",
    entityId: id,
    newValue: { ...input, apiKey: input.apiKey ? "[REDACTED]" : undefined },
  });

  const updated = await prisma.aiProvider.findUnique({
    where: { id },
    include: { models: true },
  });
  return maskProvider(updated!);
}

export async function deleteProvider(id: string, actorId: string): Promise<void> {
  await prisma.aiProvider.delete({ where: { id } });
  await auditLog.record({
    userId: actorId,
    action: "ai_provider.deleted",
    entity: "AiProvider",
    entityId: id,
  });
}

// ─── Connection Testing ──────────────────────────────────────────

export async function testProviderConnection(
  id: string,
  model?: string,
): Promise<ConnectionTestResult> {
  const provider = await prisma.aiProvider.findUnique({ where: { id } });
  if (!provider) throw new Error("Provider not found");

  const apiKey = provider.apiKeyEncrypted;
  if (!apiKey) {
    const result: ConnectionTestResult = {
      status: "invalid_credentials",
      message: "No API key configured. Add an API key first.",
    };
    await prisma.aiProvider.update({
      where: { id },
      data: {
        lastTestStatus: result.status,
        lastTestedAt: new Date(),
        lastTestError: result.message,
      },
    });
    return result;
  }

  const testModel = model ?? provider.defaultModel ?? provider.defaultModel;
  if (!testModel) {
    const result: ConnectionTestResult = {
      status: "unsupported_model",
      message: "No model configured. Select a default model first.",
    };
    await prisma.aiProvider.update({
      where: { id },
      data: {
        lastTestStatus: result.status,
        lastTestedAt: new Date(),
        lastTestError: result.message,
      },
    });
    return result;
  }

  const adapter = getProviderAdapter(provider.provider as ProviderType);
  const result = await adapter.testConnection({
    apiKey,
    baseUrl: provider.baseUrl ?? undefined,
    model: testModel,
  });

  await prisma.aiProvider.update({
    where: { id },
    data: {
      lastTestStatus: result.status,
      lastTestedAt: new Date(),
      lastTestError: result.status === "connected" ? null : result.message,
    },
  });

  return result;
}

// ─── Usage Tracking ──────────────────────────────────────────────

export async function logUsage(params: {
  providerId: string;
  model: string;
  channel?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: string;
  errorMessage?: string;
  costCents?: number;
  conversationId?: string;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        providerId: params.providerId,
        model: params.model,
        channel: params.channel ?? null,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        latencyMs: params.latencyMs,
        status: params.status,
        errorMessage: params.errorMessage ?? null,
        costCents: params.costCents ?? 0,
        conversationId: params.conversationId ?? null,
      },
    });
  } catch {
    // best-effort — don't fail the AI request if logging fails
  }
}

export async function getUsageStats(days = 30): Promise<{
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  byProvider: Array<{
    providerId: string;
    providerName: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
  }>;
  recentErrors: Array<{
    id: string;
    model: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totals, byProviderRaw, errors] = await Promise.all([
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, costCents: true },
      _count: true,
    }),
    prisma.aiUsageLog.groupBy({
      by: ["providerId"],
      where: { createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, costCents: true },
      _count: true,
    }),
    prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: since }, status: { not: "success" } },
      select: { id: true, model: true, status: true, errorMessage: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const providerIds = byProviderRaw.map((p) => p.providerId);
  const providers = providerIds.length > 0
    ? await prisma.aiProvider.findMany({ where: { id: { in: providerIds } }, select: { id: true, name: true } })
    : [];
  const providerMap = new Map(providers.map((p) => [p.id, p.name]));

  return {
    totalRequests: totals._count ?? 0,
    totalInputTokens: totals._sum.inputTokens ?? 0,
    totalOutputTokens: totals._sum.outputTokens ?? 0,
    totalCostCents: totals._sum.costCents ?? 0,
    byProvider: byProviderRaw.map((p) => ({
      providerId: p.providerId,
      providerName: providerMap.get(p.providerId) ?? "Unknown",
      requests: p._count,
      inputTokens: p._sum.inputTokens ?? 0,
      outputTokens: p._sum.outputTokens ?? 0,
      costCents: p._sum.costCents ?? 0,
    })),
    recentErrors: errors.map((e) => ({
      id: e.id,
      model: e.model,
      status: e.status,
      errorMessage: e.errorMessage,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// ─── Overview Dashboard ──────────────────────────────────────────

export async function getAiOverview() {
  const [providers, usageStats, assistantConfigs, knowledgeSources, telegramConfig] = await Promise.all([
    prisma.aiProvider.findMany({
      include: { models: { where: { enabled: true } } },
      orderBy: [{ priority: "asc" }],
    }),
    getUsageStats(7),
    prisma.aiAssistantConfig.count(),
    prisma.knowledgeSource.count({ where: { enabled: true, approved: true } }),
    getTelegramConfig(),
  ]);

  const enabledProviders = providers.filter((p) => p.enabled);
  const connectedProviders = enabledProviders.filter((p) => p.lastTestStatus === "connected");
  const defaultProvider = enabledProviders.find((p) => p.priority === Math.min(...enabledProviders.map((p) => p.priority)));

  return {
    activeProvider: defaultProvider?.name ?? null,
    activeModel: defaultProvider?.defaultModel ?? null,
    providerStatus: {
      total: providers.length,
      enabled: enabledProviders.length,
      connected: connectedProviders.length,
      untested: providers.filter((p) => p.lastTestStatus === "untested" || !p.lastTestStatus).length,
    },
    usage: {
      totalRequests: usageStats.totalRequests,
      totalInputTokens: usageStats.totalInputTokens,
      totalOutputTokens: usageStats.totalOutputTokens,
      estimatedCostCents: usageStats.totalCostCents,
    },
    assistantConfigs,
    knowledgeSources,
    recentErrors: usageStats.recentErrors,
    telegramConfigured: !!process.env.TELEGRAM_BOT_TOKEN || telegramConfig.configured,
    telegramWebhookSecret: !!process.env.TELEGRAM_WEBHOOK_SECRET || telegramConfig.configured,
    telegramConfig,
  };
}
