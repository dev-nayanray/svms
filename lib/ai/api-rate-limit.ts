/**
 * AI Assistant API Rate Limiter
 * ==============================
 *
 * Per-student rate limiting for the chat API endpoint.
 *
 * Limits:
 *  - Burst: 5 messages / minute
 *  - Hourly: 20 messages / hour
 *  - Daily: 50 messages / day
 *
 * Uses the same in-memory token-bucket pattern as
 * lib/security/rate-limit.ts. Single-instance only — for multi-
 * instance, migrate to Redis.
 */

interface ApiBucket {
  tokens: number;
  lastAccess: number;
}

const buckets = new Map<string, ApiBucket>();

const BURST_CAPACITY = 5;
const BURST_WINDOW_MS = 60_000; // 1 minute

const HOURLY_CAPACITY = 20;
const HOURLY_WINDOW_MS = 60 * 60_000; // 1 hour

const DAILY_CAPACITY = 50;
const DAILY_WINDOW_MS = 24 * 60 * 60_000; // 1 day

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Check all three rate limits (burst, hourly, daily) for a student.
 *
 * Returns { allowed: true } if all three pass, or
 * { allowed: false, retryAfterMs } if any one fails.
 */
export function checkApiRateLimit(studentId: string): RateLimitResult {
  const now = Date.now();

  // Check burst (5/min)
  const burst = checkBucket(`burst:${studentId}`, BURST_CAPACITY, BURST_WINDOW_MS, now);
  if (!burst.allowed) return burst;

  // Check hourly (20/hour)
  const hourly = checkBucket(`hourly:${studentId}`, HOURLY_CAPACITY, HOURLY_WINDOW_MS, now);
  if (!hourly.allowed) return hourly;

  // Check daily (50/day)
  const daily = checkBucket(`daily:${studentId}`, DAILY_CAPACITY, DAILY_WINDOW_MS, now);
  if (!daily.allowed) return daily;

  // All passed — consume a token from each
  consume(`burst:${studentId}`, now);
  consume(`hourly:${studentId}`, now);
  consume(`daily:${studentId}`, now);

  return { allowed: true };
}

function checkBucket(
  key: string,
  capacity: number,
  windowMs: number,
  now: number,
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastAccess: now };
    buckets.set(key, bucket);
  }

  // Refill
  const elapsed = now - bucket.lastAccess;
  const refillRate = capacity / (windowMs / 1000);
  bucket.tokens = Math.min(capacity, bucket.tokens + (elapsed / 1000) * refillRate);
  bucket.lastAccess = now;

  if (bucket.tokens >= 1) {
    return { allowed: true };
  }

  const retryAfterMs = Math.ceil((1 / refillRate) * 1000);
  return { allowed: false, retryAfterMs: Math.min(retryAfterMs, windowMs) };
}

function consume(key: string, _now: number): void {
  const bucket = buckets.get(key);
  if (bucket && bucket.tokens >= 1) {
    bucket.tokens -= 1;
  }
}

/** Reset all buckets (for tests). */
export function _resetApiRateLimitForTests(): void {
  buckets.clear();
}
