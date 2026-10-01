import "server-only";

/**
 * AI Provider Adapter Architecture
 * ================================
 *
 * Unified interface for multi-provider AI integration.
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface GenerateOptions {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
  signal?: AbortSignal;
}

export interface GenerateResult {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: number;
  model: string;
}

export type ConnectionTestResult = {
  status: "connected" | "invalid_credentials" | "unsupported_model" | "rate_limited" | "quota_exceeded" | "network_error" | "provider_unavailable";
  message: string;
  model?: string;
  latencyMs?: number;
};

export type ProviderType = "openai" | "anthropic" | "gemini" | "openai-compatible";

export interface AiProviderAdapter {
  readonly type: ProviderType;
  testConnection(params: { apiKey: string; baseUrl?: string; model: string }): Promise<ConnectionTestResult>;
  generate(params: { apiKey: string; baseUrl?: string; options: GenerateOptions }): Promise<GenerateResult>;
  listModels?(params: { apiKey: string; baseUrl?: string }): Promise<string[]>;
  getDefaultModels(): Array<{
    modelId: string;
    name: string;
    supportsStreaming: boolean;
    supportsToolCalling: boolean;
    supportsVision: boolean;
    contextWindow?: number;
    inputPricePerMillionCents?: number;
    outputPricePerMillionCents?: number;
  }>;
}

const adapters = new Map<ProviderType, AiProviderAdapter>();

export function registerAdapter(type: ProviderType, adapter: AiProviderAdapter): void {
  adapters.set(type, adapter);
}

export function getProviderAdapter(type: ProviderType): AiProviderAdapter {
  const adapter = adapters.get(type);
  if (!adapter) {
    throw new Error(`No adapter registered for provider type: ${type}`);
  }
  return adapter;
}

export function getRegisteredProviderTypes(): ProviderType[] {
  return Array.from(adapters.keys());
}
