/**
 * Per-process user cache used by the auth jwt callback.
 *
 * Extracted from lib/auth/index.ts so that service-layer files (which
 * need to call `invalidateUserCache` after security-sensitive mutations)
 * don't transitively import next-auth / next/server — both of which
 * break the vitest node environment.
 *
 * The cache is process-local. In a serverless deployment, each lambda
 * instance has its own cache; the 60-second TTL ensures cross-instance
 * staleness is bounded. For true cross-instance invalidation, a Redis
 * pub/sub channel could be added later.
 */

export type UserCacheEntry = {
  tokenVersion: number;
  roleName: string;
  status: string;
  mustChangePassword: boolean;
  fetchedAt: number;
};

const cache = new Map<string, UserCacheEntry>();

export const USER_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function getCachedUserEntry(userId: string): UserCacheEntry | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > USER_CACHE_TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return entry;
}

export function setCachedUserEntry(userId: string, entry: UserCacheEntry): void {
  cache.set(userId, entry);
}

/** Invalidate the cached user entry — call after any security-sensitive mutation. */
export function invalidateUserCache(userId: string): void {
  cache.delete(userId);
}
