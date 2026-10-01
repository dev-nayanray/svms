/**
 * AI Tool Layer — Barrel Export + Registry Builder
 * ==================================================
 *
 * This file exports all Phase 1 student tools + a `createStudentToolRegistry()`
 * function that registers them all. The agent layer imports from here.
 *
 * USAGE (in the future agent layer):
 *
 *   import { createStudentToolRegistry } from "@/lib/ai/tools";
 *   const registry = createStudentToolRegistry();
 *   const result = await registry.dispatch("getStudentProfile", {}, ctx);
 *
 * SECURITY: The registry is the ONLY way the AI agent calls tools.
 * Tools are never imported + called directly by the agent.
 */

export { ToolRegistry } from "./registry";
export { sanitizeToolResult, summarizeForResult } from "./sanitize";
export { checkToolRateLimit, _resetToolRateLimitForTests } from "./rate-limit";
export type {
  AiTool,
  ToolContext,
  ToolResult,
  ToolError,
  ToolErrorCode,
  ToolCallLog,
} from "./types";

// ── Tool implementations ─────────────────────────────────────────

import { ToolRegistry } from "./registry";
import { getStudentProfile } from "./student-profile";
import { getStudentCourses } from "./student-courses";
import { getStudentResults } from "./student-results";
import { getStudentGPA } from "./student-gpa";
import { getStudentAttendance } from "./student-attendance";
import { getStudentAssignments } from "./student-assignments";
import { getStudentSchedule } from "./student-schedule";
import { getStudentNotifications } from "./student-notifications";

/**
 * All Phase 1 student-facing tools.
 *
 * These are read-only — no write operations. Write tools
 * (createSupportTicket, draftMessageToCounselor) arrive in Phase 2
 * and require explicit UI confirmation before executing.
 */
export const STUDENT_TOOLS = [
  getStudentProfile,
  getStudentCourses,
  getStudentResults,
  getStudentGPA,
  getStudentAttendance,
  getStudentAssignments,
  getStudentSchedule,
  getStudentNotifications,
] as const;

/**
 * Create a ToolRegistry with all Phase 1 student tools registered.
 *
 * The agent layer calls this once per request (or once per app
 * lifecycle — the registry is stateless except for the rate-limiter's
 * in-memory buckets, which are shared).
 */
export function createStudentToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of STUDENT_TOOLS) {
    registry.register(tool);
  }
  return registry;
}

/**
 * The list of tool names — useful for building LLM tool definitions
 * without instantiating the registry.
 */
export const STUDENT_TOOL_NAMES = STUDENT_TOOLS.map((t) => t.name) as readonly string[];
