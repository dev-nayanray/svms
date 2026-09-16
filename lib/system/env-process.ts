/**
 * Synchronous env-var checker (process.env only).
 *
 * Used by the async `isConfigured()` in env.ts as a fast first check,
 * and by health.ts for vars that are NEVER stored in DB (DATABASE_URL,
 * AUTH_SECRET, etc.).
 */

export function isEnvConfigured(key: string): boolean {
  const raw = process.env[key];
  return (
    !!raw &&
    raw.trim().length > 0 &&
    raw.trim() !== "change-me-to-a-random-32-char-string"
  );
}
