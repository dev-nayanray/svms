/**
 * AI Tool Layer — Response Sanitization
 * ======================================
 *
 * Every tool result passes through `sanitizeToolResult()` before
 * being returned to the agent layer (and ultimately to the LLM).
 *
 * This is the LAST line of defense against leaking sensitive data
 * to the AI model. Even if a tool accidentally returns a field it
 * shouldn't, the sanitization layer strips it.
 *
 * See SVMS_AI_ASSISTANT_ARCHITECTURE.md §8 (Database Access Flow)
 * for the full sanitization contract.
 */

/**
 * Field names that are ALWAYS stripped from tool results, regardless
 * of the tool's declared return shape. These are fields the LLM
 * should never see.
 *
 * - Password hashes, tokens, secrets (auth/security fields)
 * - Internal ObjectIds (the LLM doesn't need MongoDB _id values)
 * - Soft-delete metadata (internal bookkeeping)
 * - File URLs (private document paths)
 */
const FORBIDDEN_FIELDS: ReadonlySet<string> = new Set([
  // Auth / security fields
  "passwordHash",
  "resetTokenHash",
  "resetTokenExpiry",
  "token",
  "secret",
  "apiKey",
  "apiSecret",
  // Internal IDs (ObjectIds — the LLM doesn't need these)
  "_id",
  "userId",
  "assignedEmployeeId",
  "branchId",
  "employeeId",
  "createdById",
  "deletedBy",
  "reviewedById",
  "uploadedById",
  "cancelledBy",
  "resolvedById",
  "replacedId",
  // Soft-delete metadata
  "deletedAt",
  "deletedBy",
  // File URLs (private)
  "certificateUrl",
  "transcriptUrl",
  "fileUrl",
  "fileName",
  "mimeType",
  "fileSize",
  "meetingLink", // could be a private video call URL
  // PII that the LLM doesn't need
  "passportNumber",
  "passportIssueDate",
  "passportExpiryDate",
  "passportIssuingCountry",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
  "profilePhotoUrl",
]);

/**
 * Fields that are redacted (replaced with "[REDACTED]") rather than
 * stripped entirely — when their presence is meaningful but their
 * value is sensitive. Currently empty — all sensitive fields are
 * fully stripped.
 */
const REDACTED_FIELDS: ReadonlySet<string> = new Set([]);

/**
 * Recursively sanitize an object for return to the LLM.
 *
 * 1. Strips all keys in FORBIDDEN_FIELDS (at every nesting level).
 * 2. Redacts all keys in REDACTED_FIELDS.
 * 3. Truncates long strings to prevent context overflow.
 * 4. Converts Date objects to ISO strings (LLMs handle strings better).
 *
 * This function is recursive and handles:
 *  - Plain objects
 *  - Arrays
 *  - Primitives (string, number, boolean, null)
 *  - Date objects
 */
export function sanitizeToolResult(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncateString(value);
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeToolResult);
  if (typeof value === "object") return sanitizeObject(value as Record<string, unknown>);
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (FORBIDDEN_FIELDS.has(key)) continue;
    if (REDACTED_FIELDS.has(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    result[key] = sanitizeToolResult(val);
  }
  return result;
}

/**
 * Maximum string length in tool results. Longer strings are truncated
 * with a "..." suffix. This prevents a single tool result from
 * consuming the entire LLM context window.
 */
const MAX_STRING_LENGTH = 2000;

function truncateString(s: string): string {
  if (s.length <= MAX_STRING_LENGTH) return s;
  return s.slice(0, MAX_STRING_LENGTH) + "...";
}

/**
 * Create a short summary of a tool result for logging.
 *
 * The full result is returned to the LLM, but only this summary is
 * written to the log (to save space + avoid logging large payloads).
 */
export function summarizeForResult(result: unknown): string {
  const json = JSON.stringify(result);
  if (json === undefined) return "undefined";
  return json.length > 500 ? json.slice(0, 500) + "..." : json;
}
