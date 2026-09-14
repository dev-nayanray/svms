/**
 * Canonical country enums and pure helpers — shared by API validation,
 * UI filters, the country detail page, and tests. No DB access here.
 *
 * The emoji flag is derived from the ISO 3166-1 alpha-2 code via regional
 * indicator symbols; the `flag` column on `Country` is a denormalized cache
 * for cases where the code is a 3-letter alpha-3 (no emoji mapping) or
 * the admin wants a custom emoji/text override.
 */

import { countryFlag } from "@/lib/utils/country";

export const COUNTRY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type CountryStatus = (typeof COUNTRY_STATUSES)[number];

export const COUNTRY_STATUS_LABELS: Record<CountryStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/** Document requirement scopes (mirrors DocumentRequirement.appliesTo). */
export const DOC_REQUIREMENT_SCOPES = ["APPLICATION", "VISA", "PROFILE"] as const;
export type DocRequirementScope = (typeof DOC_REQUIREMENT_SCOPES)[number];

export const DOC_REQUIREMENT_SCOPE_LABELS: Record<DocRequirementScope, string> = {
  APPLICATION: "Application",
  VISA: "Visa",
  PROFILE: "Profile",
};

/**
 * Normalize a user-supplied country code: trim, uppercase, strip spaces.
 * Does NOT validate length — that's the schema's job. Returns "" for
 * null/undefined so callers can feed it straight into a regex check.
 */
export function normalizeCountryCode(code: string | null | undefined): string {
  if (!code) return "";
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Resolve the flag to display for a country: prefer an explicit override,
 * otherwise derive an emoji from the alpha-2 code. Returns null when no
 * flag can be rendered (e.g. alpha-3 code with no override).
 */
export function resolveCountryFlag(
  code: string | null | undefined,
  flagOverride: string | null | undefined,
): string | null {
  if (flagOverride && flagOverride.trim()) return flagOverride.trim();
  return countryFlag(code);
}

/**
 * Pure guard: returns a human-readable reason when a country cannot be
 * archived, or null when archiving is allowed. Mirrors the server-side
 * check in `app/api/countries/[id]/route.ts` so the UI can pre-flight
 * without round-tripping. Active applications block archiving because
 * the country is part of an in-flight application's identity.
 */
export function archiveBlockReason(country: {
  status?: string | null;
  deletedAt?: Date | string | null;
  _count?: { applications?: number } | null;
}): string | null {
  if (country.deletedAt) return "Country is already archived";
  const active = country._count?.applications ?? 0;
  if (active > 0) {
    return `${active} active application(s) reference this country — deactivate it instead of archiving`;
  }
  return null;
}

/**
 * Slugify a country name into a URL-friendly identifier. Used for
 * deep-link anchors on the detail page and as a fallback display key.
 */
export function countrySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
