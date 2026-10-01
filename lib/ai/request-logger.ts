/**
 * AI Assistant Request Logger
 * ============================
 *
 * Structured request logging for the AI assistant API routes.
 *
 * SECURITY:
 *  - NEVER logs the student's ObjectId (uses a masked version)
 *  - NEVER logs the full message content (only length + preview)
 *  - NEVER logs API keys, tokens, or provider response bodies
 *  - NEVER logs tool results (only the tool name + success/fail)
 *
 * All logs are structured JSON to stdout (captured by Vercel /
 * the hosting platform's log aggregator).
 */

import "server-only";

export interface AiRequestLog {
  /** Request UUID for correlation across logs. */
  requestId: string;
  /** The event name (e.g. "ai.chat.request", "ai.chat.done"). */
  event: string;
  /** Masked student ID (first 4 + last 4 chars). */
  studentId: string;
  /** HTTP method. */
  method: string;
  /** Route path. */
  path: string;
  /** ISO timestamp. */
  timestamp: string;
  /** Duration in milliseconds (for done/error events). */
  durationMs?: number;
  /** Message length (for chat requests — never the content). */
  messageLength?: number;
  /** Message preview (first 50 chars, for debugging — no PII). */
  messagePreview?: string;
  /** Conversation ID (masked). */
  conversationId?: string;
  /** HTTP status code (for response events). */
  statusCode?: number;
  /** Error code (for error events). */
  errorCode?: string;
  /** Error message (for error events — safe, user-facing). */
  errorMessage?: string;
  /** Token usage (for done events). */
  inputTokens?: number;
  outputTokens?: number;
  /** Tool calls made during the request (names only, no args). */
  toolCalls?: string[];
}

/**
 * Log an AI assistant request event.
 *
 * Writes structured JSON to stdout. The log is safe for production
 * — no PII, no secrets, no full message content.
 */
export function logAiRequest(log: AiRequestLog): void {
  const entry = {
    ...log,
    studentId: maskId(log.studentId),
    conversationId: log.conversationId ? maskId(log.conversationId) : undefined,
    level: log.event.endsWith(".error") ? "warn" : "info",
  };

  // Remove undefined fields for cleaner logs
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (value !== undefined) clean[key] = value;
  }

  console.log(JSON.stringify(clean));
}

/**
 * Mask an ID for logging — shows first 4 + last 4 chars.
 * e.g. "64a1b2c3d4e5f6a7b8c9" → "64a1...b8c9"
 * Short IDs (≤8 chars) are fully masked: "***".
 */
function maskId(id: string): string {
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

/**
 * Create a preview of a user message for logging.
 * Returns the first 50 chars — enough for debugging, not enough
 * to expose sensitive details. The preview is also run through
 * the sensitive-data sanitizer (from conversation.ts) to strip
 * API keys, passwords, tokens, and connection strings.
 */
export function previewMessage(message: string): string {
  const truncated = message.length <= 50 ? message : message.slice(0, 50) + "...";
  return redactSensitiveInPreview(truncated);
}

/**
 * Redact sensitive patterns from a log preview string.
 * This is a lightweight version of the conversation sanitizer —
 * it covers the most common patterns (API keys, passwords, tokens,
 * connection strings) without importing the full sanitizer (which
 * is server-only and would create a circular dependency).
 */
function redactSensitiveInPreview(text: string): string {
  let redacted = text;
  redacted = redacted.replace(/\b(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36})\b/g, "[REDACTED]");
  redacted = redacted.replace(/\b(password|pwd|secret|token|apikey|api_key)\s*[=:]\s*\S+/gi, "$1=[REDACTED]");
  redacted = redacted.replace(/\b(mongodb(\+srv)?|postgres|mysql|redis):\/\/[^\s]+/gi, "[REDACTED]");
  return redacted;
}

/**
 * Generate a unique request ID (UUID v4).
 * Uses crypto.randomUUID() (available in Node 19+ + all modern browsers).
 */
export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
