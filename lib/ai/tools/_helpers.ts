/**
 * AI Tool Layer — Shared Helpers
 * ===============================
 *
 * Common utilities used by all student-facing tools:
 *  - Role authorization check
 *  - Error constructors
 *  - Date formatting (for consistent LLM-friendly output)
 */

import type { ToolContext, ToolResult, ToolError } from "./types";

/**
 * Phase 1: Only STUDENT role can call these tools.
 *
 * If an admin or employee reaches this layer (which shouldn't happen
 * — the API route guard prevents it), we return FORBIDDEN.
 *
 * Phase 4+ will add separate employee/admin tools with their own
 * authorization logic (checking `assignedEmployeeId`, etc.).
 */
export function authorizeStudentOnly(ctx: ToolContext): ToolError | null {
  if (ctx.role !== "STUDENT") {
    return {
      code: "FORBIDDEN",
      message: "This tool is only available to students.",
      retryable: false,
    };
  }
  return null;
}

/** Construct a NOT_FOUND error. */
export function notFound(what: string): ToolError {
  return {
    code: "NOT_FOUND",
    message: `${what} not found.`,
    retryable: false,
  };
}

/** Construct an INTERNAL error from a caught exception. */
export function internalError(toolName: string, err: unknown): ToolError {
  const message = err instanceof Error ? err.message : "Unknown error";
  return {
    code: "INTERNAL",
    message: `Tool ${toolName} failed: ${message}`,
    retryable: false,
  };
}

/** Wrap a successful result. */
export function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

/** Wrap an error. */
export function fail(error: ToolError): ToolResult<never> {
  return { ok: false, error };
}

/**
 * Format a Date for LLM consumption.
 * Returns ISO 8601 string (e.g. "2026-09-15T14:30:00.000Z").
 * The LLM can parse this and present it in any locale.
 */
export function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  if (typeof date === "string") return date;
  return date.toISOString();
}

/**
 * Format a future date as a relative time from now.
 * e.g. "in 3 days", "in 2 hours", "tomorrow", "now".
 *
 * The LLM could do this itself, but providing it pre-computed
 * reduces token usage + ensures consistency.
 */
export function relativeTime(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMs / 3_600_000);
  const diffDays = Math.round(diffMs / 86_400_000);

  if (Math.abs(diffMins) < 1) return "now";
  if (diffMins < 0) return `${Math.abs(diffMins)} minute(s) ago`;
  if (diffMins < 60) return `in ${diffMins} minute(s)`;
  if (diffHours < 24) return `in ${diffHours} hour(s)`;
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 7) return `in ${diffDays} day(s)`;
  return formatDate(d);
}
