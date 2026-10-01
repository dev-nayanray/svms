/**
 * AI Tool Layer — Tool Registry
 * ==============================
 *
 * The registry is the SINGLE ENTRY POINT from the agent layer to the
 * database. The LLM calls tools by name; the registry:
 *
 *  1. Looks up the tool by name (unknown tools → error)
 *  2. Validates the LLM-provided args with the tool's Zod schema
 *  3. STRIPS `studentId`, `userId`, `role` from args (defense in depth)
 *  4. Checks the per-student rate limit
 *  5. Enforces a timeout (default 5s)
 *  6. Calls the tool's `execute()` with the authenticated `ToolContext`
 *  7. Sanitizes the result (strips PII / forbidden fields)
 *  8. Logs the call (to console now; to `AiToolCall` DB table in Phase 0)
 *
 * CRITICAL SECURITY INVARIANT
 * ============================
 *
 * The `ToolContext.studentId` is set by the API route handler from
 * the authenticated NextAuth session. It is NEVER taken from LLM
 * args. Even if the LLM sends `{ "studentId": "abc123" }` as a tool
 * argument, the registry strips it before the tool sees it.
 *
 * See SVMS_AI_ASSISTANT_ARCHITECTURE.md §5 + §13.
 */

import type { AiTool, ToolContext, ToolResult, ToolCallLog } from "./types";
import { sanitizeToolResult, summarizeForResult } from "./sanitize";
import { checkToolRateLimit } from "./rate-limit";

/**
 * Fields that are ALWAYS stripped from LLM-provided tool args,
 * regardless of what the tool's Zod schema declares.
 *
 * This is defense in depth — even if a tool accidentally includes
 * `studentId` in its schema, the registry removes it.
 */
const STRIP_FROM_ARGS: ReadonlySet<string> = new Set([
  "studentId",
  "userId",
  "role",
  "requestId",
  "ctx",
  "context",
]);

export class ToolRegistry {
  private tools = new Map<string, AiTool>();

  /** Register a tool. Throws if a tool with the same name exists. */
  register(tool: AiTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Get all registered tools (for building LLM tool definitions). */
  list(): readonly AiTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Dispatch a tool call from the agent layer.
   *
   * This is the ONLY method the agent calls. It handles:
   *  - Tool lookup
   *  - Arg validation (Zod)
   *  - studentId stripping (defense in depth)
   *  - Rate limiting
   *  - Timeout enforcement
   *  - Result sanitization
   *  - Logging
   */
  async dispatch(
    toolName: string,
    rawArgs: unknown,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    // 1. Look up the tool
    const tool = this.tools.get(toolName);
    if (!tool) {
      this.log({
        requestId: ctx.requestId,
        toolName,
        studentId: ctx.studentId,
        args: rawArgs,
        success: false,
        durationMs: 0,
        error: "Tool not found",
        timestamp: new Date().toISOString(),
      });
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Unknown tool: ${toolName}`,
          retryable: false,
        },
      };
    }

    // 2. Strip identity fields from args (defense in depth)
    const cleanedArgs = stripIdentityFields(rawArgs);

    // 3. Validate args with the tool's Zod schema
    const parseResult = tool.parameters.safeParse(cleanedArgs);
    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((i) => `${i.path.map(String).join(".")}: ${i.message}`)
        .join("; ");
      this.log({
        requestId: ctx.requestId,
        toolName,
        studentId: ctx.studentId,
        args: cleanedArgs,
        success: false,
        durationMs: Date.now() - startTime,
        error: `Validation error: ${message}`,
        timestamp: new Date().toISOString(),
      });
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: `Invalid tool arguments: ${message}`,
          retryable: false,
        },
      };
    }

    // 4. Check rate limit
    const rateLimit = checkToolRateLimit(ctx.studentId, toolName);
    if (!rateLimit.allowed) {
      this.log({
        requestId: ctx.requestId,
        toolName,
        studentId: ctx.studentId,
        args: cleanedArgs,
        success: false,
        durationMs: Date.now() - startTime,
        error: `Rate limited (retry after ${rateLimit.retryAfterMs}ms)`,
        timestamp: new Date().toISOString(),
      });
      return {
        ok: false,
        error: {
          code: "TIMEOUT", // Reuse TIMEOUT code — agent should back off
          message: `Tool rate limit reached. Try again in ${Math.ceil(rateLimit.retryAfterMs / 1000)} seconds.`,
          retryable: true,
        },
      };
    }

    // 5. Execute with timeout
    const timeoutMs = ctx.timeoutMs ?? 5000;
    try {
      const result = await withTimeout(
        tool.execute(parseResult.data, ctx),
        timeoutMs,
      );

      const durationMs = Date.now() - startTime;

      if (result.ok) {
        // 6. Sanitize the result before returning
        const sanitized = sanitizeToolResult(result.data);
        this.log({
          requestId: ctx.requestId,
          toolName,
          studentId: ctx.studentId,
          args: cleanedArgs,
          success: true,
          durationMs,
          resultSummary: summarizeForResult(sanitized),
          timestamp: new Date().toISOString(),
        });
        return { ok: true, data: sanitized };
      } else {
        this.log({
          requestId: ctx.requestId,
          toolName,
          studentId: ctx.studentId,
          args: cleanedArgs,
          success: false,
          durationMs,
          error: result.error.message,
          timestamp: new Date().toISOString(),
        });
        return result;
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : "Unknown error";
      this.log({
        requestId: ctx.requestId,
        toolName,
        studentId: ctx.studentId,
        args: cleanedArgs,
        success: false,
        durationMs,
        error: message,
        timestamp: new Date().toISOString(),
      });

      // Check if it was a timeout
      if (err instanceof TimeoutError) {
        return {
          ok: false,
          error: {
            code: "TIMEOUT",
            message: `Tool ${toolName} timed out after ${timeoutMs}ms.`,
            retryable: true,
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "INTERNAL",
          message: `Tool ${toolName} failed: ${message}`,
          retryable: false,
        },
      };
    }
  }

  /**
   * Write a log entry for a tool call.
   *
   * Phase 1: logs to console as structured JSON.
   * Phase 0 (when AiToolCall model exists): will also persist to DB.
   */
  private log(entry: ToolCallLog): void {
    // Mask the studentId in logs (don't log the full ObjectId)
    const maskedStudentId = maskId(entry.studentId);
    console.log(
      JSON.stringify({
        ...entry,
        studentId: maskedStudentId,
        level: entry.success ? "info" : "warn",
      }),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Strip identity fields from LLM-provided tool args.
 *
 * This is defense in depth. The tool's Zod schema should already
 * reject these fields (via `.strict()`), but if it doesn't, the
 * registry removes them before the tool sees them.
 */
function stripIdentityFields(args: unknown): unknown {
  if (args === null || args === undefined) return args;
  if (typeof args !== "object" || Array.isArray(args)) return args;
  const obj = args as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (STRIP_FROM_ARGS.has(key)) continue;
    cleaned[key] = val;
  }
  return cleaned;
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Mask an ID for logging — shows first 4 + last 4 chars.
 * e.g. "64a1b2c3d4e5f6..." → "64a1...f6..."
 */
function maskId(id: string): string {
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}
