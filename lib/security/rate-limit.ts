/**
 * In-memory token-bucket rate limiter.
 *
 * Design
 * ======
 *
 * This is a minimal, dependency-free rate limiter that lives in the
 * Node.js process. It is appropriate for single-instance deployments
 * (e.g. a small VPS running `next start`, or a container with one
 * process). For multi-instance deployments (serverless, autoscaling,
 * Kubernetes with >1 replica), this MUST be replaced with a shared
 * backend (Redis or a Prisma-backed counter table).
 *
 * The limiter uses the standard token-bucket algorithm:
 *  - Each `key` (typically an IP or userId) has a bucket.
 *  - The bucket has a `capacity` (max tokens) and a `refillRate`
 *    (tokens per second).
 *  - Each request consumes `cost` tokens (default 1).
 *  - If the bucket has fewer tokens than `cost`, the request is
 *    rejected with 429 TOO_MANY_REQUESTS.
 *
 * Memory hygiene
 * --------------
 * Buckets are stored in a Map. A sweep runs on every check: any
 * bucket whose lastAccess is older than `TTL_MS` is evicted to
 * prevent unbounded growth.
 */

type Bucket = {
  /** Tokens currently in the bucket. */
  tokens: number;
  /** Last access time (ms since epoch). Used for TTL eviction. */
  lastAccess: number;
};

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const SWEEP_EVERY = 100; // sweep the map every N calls

let sweepCounter = 0;

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  /** Maximum tokens in the bucket (i.e. burst size). */
  capacity: number;
  /** Tokens added per second. */
  refillRate: number;
  /** Tokens consumed per request. Default 1. */
  cost?: number;
};

export type RateLimitResult = {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Tokens remaining after this request (clamped >= 0). */
  remaining: number;
  /** Seconds to wait before the next token is available (0 if allowed). */
  retryAfter: number;
};

/**
 * Check whether a request identified by `key` should be allowed
 * under the given `config`. Mutates the bucket.
 *
 * Side effects: every `SWEEP_EVERY`-th call triggers a sweep that
 * evicts stale buckets (older than TTL_MS).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  // Sweep stale buckets periodically to bound memory.
  if (++sweepCounter >= SWEEP_EVERY) {
    sweepCounter = 0;
    const cutoff = Date.now() - TTL_MS;
    for (const [k, b] of buckets) {
      if (b.lastAccess < cutoff) buckets.delete(k);
    }
  }

  const now = Date.now();
  const cost = config.cost ?? 1;
  const existing = buckets.get(key);

  let bucket: Bucket;
  if (existing) {
    // Refill: tokens regrow proportional to elapsed time, up to capacity.
    const elapsedSec = (now - existing.lastAccess) / 1000;
    const refilled = Math.min(
      config.capacity,
      existing.tokens + elapsedSec * config.refillRate,
    );
    bucket = { tokens: refilled, lastAccess: now };
  } else {
    bucket = { tokens: config.capacity, lastAccess: now };
  }

  if (bucket.tokens >= cost) {
    bucket.tokens -= cost;
    buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfter: 0,
    };
  }

  // Denied — store the refilled bucket so subsequent retries still
  // see progress (don't reset).
  buckets.set(key, bucket);
  const deficit = cost - bucket.tokens;
  const retryAfter = Math.ceil(deficit / config.refillRate);
  return {
    allowed: false,
    remaining: 0,
    retryAfter,
  };
}

/**
 * Build a `Retry-After` and `X-RateLimit-*` header set for a 429
 * response. Returns undefined if the request was allowed (caller
 * should not send these headers on success).
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "Retry-After": String(result.retryAfter || 1),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}

/**
 * Preset rate-limit configs for sensitive endpoints. All values are
 * conservative and tuned for a single human user — they are not
 * intended for legitimate high-volume API consumers.
 *
 * Keys are the routes / route groups they apply to.
 */
export const RATE_LIMIT_PRESETS = {
  /** Login — protect against credential-stuffing / brute force. */
  login: { capacity: 5, refillRate: 1 / 60 }, // 5 attempts, +1/min
  /** Password change — protect against current-password brute force. */
  passwordChange: { capacity: 5, refillRate: 1 / 60 }, // 5 attempts, +1/min
  /** File upload — protect against storage DoS. */
  upload: { capacity: 20, refillRate: 1 / 3 }, // 20 uploads, +1/3s
  /** Message send — protect against notification spam. */
  messageSend: { capacity: 30, refillRate: 1 / 2 }, // 30 messages, +1/2s
  /** Document download — protect against file-read DoS + audit-log flood. */
  download: { capacity: 60, refillRate: 1 }, // 60 downloads/min
  /** Support ticket — protect against ticket spam. */
  supportTicket: { capacity: 5, refillRate: 1 / 60 }, // 5 tickets, +1/min
  /** Counseling request — protect against request spam. */
  counselingRequest: { capacity: 10, refillRate: 1 / 30 }, // 10 reqs, +1/30s
  /** Account registration — protect against account-creation flood. */
  register: { capacity: 5, refillRate: 1 / 60 }, // 5 signups, +1/min
} as const satisfies Record<string, RateLimitConfig>;

/**
 * Build a rate-limit key from an IP + optional userId. Using both
 * means an attacker rotating accounts from one IP is still throttled,
 * and a single user behind a NAT is not blocked by another user's
 * abuse.
 */
export function buildRateLimitKey(req: Request, suffix: string): string {
  const xff = req.headers.get("x-forwarded-for");
  let ip: string | undefined;
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) ip = first;
  }
  if (!ip) ip = req.headers.get("x-real-ip") ?? "unknown";
  return `${suffix}:${ip}`;
}

/**
 * Check the rate limit and, if exceeded, return a 429 Response.
 * Otherwise returns null so the caller can proceed.
 *
 * Usage:
 *   const limited = rateLimit(req, RATE_LIMIT_PRESETS.login, "login");
 *   if (limited) return limited;
 *
 * In test environment (NODE_ENV === "test"), this is a no-op — tests
 * would otherwise exhaust the in-memory bucket on the Nth call and
 * the (N+1)th test would spuriously fail with 429.
 */
export function rateLimit(
  req: Request,
  config: RateLimitConfig,
  suffix: string,
): Response | null {
  if (process.env.NODE_ENV === "test") return null;
  const key = buildRateLimitKey(req, suffix);
  const result = checkRateLimit(key, config);
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
          retryAfter: result.retryAfter,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...rateLimitHeaders(result),
        },
      },
    );
  }
  return null;
}

/**
 * Test-only helper: clear the in-memory rate-limit buckets. Used by
 * test setup to ensure a clean state between test files. Has no
 * effect in production.
 */
export function __clearRateLimitBucketsForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  buckets.clear();
}
