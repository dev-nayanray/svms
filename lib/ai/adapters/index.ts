import "server-only";
import { registerAdapter } from "./types";
import { openaiAdapter } from "./openai";
import { anthropicAdapter } from "./anthropic";
import { geminiAdapter } from "./gemini";

/**
 * Adapter Registry
 * =================
 *
 * Registers all provider adapters at module load time.
 */

let initialized = false;

export function ensureAdaptersRegistered(): void {
  if (initialized) return;
  registerAdapter("openai", openaiAdapter);
  registerAdapter("anthropic", anthropicAdapter);
  registerAdapter("gemini", geminiAdapter);
  // openai-compatible uses the same adapter as openai (with a custom baseUrl)
  registerAdapter("openai-compatible", openaiAdapter);
  initialized = true;
}

// Auto-register on import
ensureAdaptersRegistered();

// Re-export everything consumers need
export { openaiAdapter } from "./openai";
export { anthropicAdapter } from "./anthropic";
export { geminiAdapter } from "./gemini";
export {
  registerAdapter,
  getProviderAdapter,
  getRegisteredProviderTypes,
} from "./types";
export type {
  AiProviderAdapter,
  ProviderType,
  ConnectionTestResult,
  GenerateResult,
  GenerateOptions,
  ChatMessage,
  ChatRole,
  ToolCall,
  ToolDefinition,
} from "./types";
