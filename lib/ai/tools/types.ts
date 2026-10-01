/**
 * AI Tool Layer — Type Definitions
 * =================================
 *
 * These types define the contract between the AI agent layer and the
 * controlled tool layer. The critical security invariant is:
 *
 *   `studentId` is ALWAYS injected via `ToolContext` from the
 *   authenticated server session. It is NEVER accepted as a tool
 *   parameter from the LLM or the frontend.
 *
 * See SVMS_AI_ASSISTANT_ARCHITECTURE.md §5 (Tool Layer) for the
 * full design.
 */

import type { z } from "zod";

/**
 * The authenticated context injected into every tool execution.
 *
 * This object is constructed server-side by the API route handler
 * (using `studentApiGuard()`) and passed through the `ToolRegistry`.
 * The LLM never sees this object — it only sees tool results.
 */
export interface ToolContext {
  /**
   * The authenticated student's ObjectId in the `Student` collection.
   *
   * SECURITY: This value is derived from the NextAuth session
   * (`studentApiGuard()` → `student.id`). It is NEVER accepted from
   * LLM-provided tool arguments. The `ToolRegistry` strips any
   * `studentId` field from LLM args before calling `execute()`.
   */
  studentId: string;

  /**
   * The authenticated user's ObjectId in the `User` collection.
   * Used for audit logging.
   */
  userId: string;

  /**
   * The authenticated user's role. In Phase 1, only "STUDENT" is
   * allowed to call these tools. Phase 4+ adds EMPLOYEE/ADMIN tools.
   */
  role: string;

  /**
   * Unique request ID (UUID) for log correlation across the
   * agent → registry → tool → database pipeline.
   */
  requestId: string;

  /**
   * Per-tool execution timeout in milliseconds. Default 5000.
   * Enforced by the registry via `Promise.race`.
   */
  timeoutMs?: number;
}

/**
 * The result of a tool execution.
 *
 * Tools return a discriminated union — either `{ ok: true, data }`
 * or `{ ok: false, error }`. The agent layer handles both cases:
 *  - On success, `data` is appended to the LLM message history.
 *  - On failure, `error` is returned to the LLM as the tool result
 *    so the LLM can explain the issue to the student.
 */
export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: ToolError };

/**
 * A structured tool error. The `code` is machine-readable (used by
 * the agent for retry logic); the `message` is human-readable (shown
 * to the student via the LLM's response).
 */
export interface ToolError {
  /** NOT_FOUND | FORBIDDEN | TIMEOUT | VALIDATION | INTERNAL | UNAVAILABLE */
  code: ToolErrorCode;
  /** Human-readable explanation (safe to pass to the LLM). */
  message: string;
  /** Whether the agent should retry the tool call. */
  retryable: boolean;
}

export type ToolErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "TIMEOUT"
  | "VALIDATION"
  | "INTERNAL"
  | "UNAVAILABLE";

/**
 * The contract every AI tool must implement.
 *
 * Tools are registered in the `ToolRegistry` and called by the agent
 * layer. Each tool:
 *  1. Declares a Zod schema for its LLM-provided parameters.
 *     (This schema MUST NOT include `studentId` — that's injected.)
 *  2. Implements `execute()`, which receives validated args + the
 *     authenticated `ToolContext`.
 *  3. Returns a `ToolResult` — either data or a structured error.
 */
export interface AiTool<T = unknown> {
  /** Unique tool name (e.g. "getStudentProfile"). */
  name: string;

  /** Description shown to the LLM so it knows when to call this tool. */
  description: string;

  /**
   * Zod schema for the tool's LLM-provided parameters.
   *
   * SECURITY: This schema MUST NOT include `studentId`, `userId`,
   * or any identity field. The registry strips these defensively
   * even if they appear here.
   */
  parameters: z.ZodSchema;

  /**
   * Execute the tool with validated args + authenticated context.
   *
   * Implementations MUST:
   *  - Use `ctx.studentId` for all database queries (never args)
   *  - Include `deletedAt: null` in all WHERE clauses (soft-delete)
   *  - Return sanitized data (no PII, no internal IDs unless needed)
   *  - Catch + wrap all errors in `ToolError`
   */
  execute: (args: unknown, ctx: ToolContext) => Promise<ToolResult<T>>;
}

/**
 * The shape of a log entry written by the registry for each tool call.
 *
 * In Phase 0, these go to console (structured JSON). When the
 * `AiToolCall` Prisma model is added, they'll be persisted to the DB.
 */
export interface ToolCallLog {
  requestId: string;
  toolName: string;
  studentId: string;
  args: unknown;
  success: boolean;
  durationMs: number;
  error?: string;
  resultSummary?: string;
  timestamp: string;
}
