/**
 * Pure country helpers — shared by API, UI, and tests.
 */

/**
 * Convert an ISO 3166-1 alpha-2 code to its emoji flag using regional
 * indicator symbols. Returns null for invalid input.
 */
export function countryFlag(code: string | null | undefined): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const base = 0x1f1e6;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    base + (upper.charCodeAt(0) - 65),
    base + (upper.charCodeAt(1) - 65)
  );
}

export const COUNTRY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
