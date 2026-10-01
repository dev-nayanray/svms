/**
 * AI Tool Layer — Per-Student Rate Limiter
 * =========================================
 *
 * Limits how many tool calls a single student can make per minute.
 * This is defense-in-depth on top of the API-route-level rate limit
 * (which limits chat messages, not individual tool calls).
 *
 * One chat message can trigger up to 5 tool calls (the agent's
 * max-rounds limit). So if the API allows 5 messages/minute, a
 * student could trigger up to 25 tool calls/minute. This limiter
 * caps tool calls independently.
 *
 * DESIGN
 * ======
 *
 * Uses the same in-memory token-bucket pattern as
 * `lib/security/rate-limit.ts`. Single-instance only — for multi-
 * instance deployments (Vercel with >1 replica), migrate to Redis.
 *
 * The bucket is keyed by `${studentId}:${toolName}` so a student
 * can't exhaust their budget on one tool then spam another.
 */

interface Bucket {
  tokens: number;
  lastAccess: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const SWEEP_EVERY = 100;

const buckets = new Map<string, Bucket>();
let sweepCounter = 0;

export interface ToolRateLimitConfig {
  /** Maximum tool calls per window per student per tool. Default 30. */
  capacity: number;
  /** Window in milliseconds. Default 60_000 (1 minute). */
  windowMs: number;
}

const DEFAULT_CONFIG: ToolRateLimitConfig = {
  capacity: 30,
  windowMs: 60_000,
};

/**
 * Check if a student can call a tool right now.
 *
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
 *
 * The key is `${studentId}:${toolName}` — each tool has its own
 * budget per student.
 */
export function checkToolRateLimit(
  studentId: string,
  toolName: string,
  config: Partial<ToolRateLimitConfig> = {},
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const key = `${studentId}:${toolName}`;

  maybeSweep();

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: cfg.capacity, lastAccess: now };
    buckets.set(key, bucket);
  }

  // Refill: add tokens based on elapsed time
  const elapsed = now - bucket.lastAccess;
  const refillRate = cfg.capacity / (cfg.windowMs / 1000); // tokens per second
  const refilled = Math.min(cfg.capacity, bucket.tokens + (elapsed / 1000) * refillRate);
  bucket.tokens = refilled;
  bucket.lastAccess = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true };
  }

  // Calculate retry-after: time until 1 token refills
  const retryAfterMs = Math.ceil((1 / refillRate) * 1000);
  return { allowed: false, retryAfterMs: Math.min(retryAfterMs, cfg.windowMs) };
}

/**
 * Reset the rate limiter state. Used in tests.
 */
export function _resetToolRateLimitForTests(): void {
  buckets.clear();
  sweepCounter = 0;
}

function maybeSweep(): void {
  sweepCounter++;
  if (sweepCounter < SWEEP_EVERY) return;
  sweepCounter = 0;

  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastAccess > TTL_MS) {
      buckets.delete(key);
    }
  }
}
