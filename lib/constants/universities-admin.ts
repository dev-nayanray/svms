/**
 * Pure helpers for the Admin University Management module.
 *
 * These functions are the single source of truth for:
 *  - slug normalization (mirrors the server-side slugify + timestamp suffix)
 *  - the archive guard (universities with active applications cannot be
 *    archived — they must be deactivated instead)
 *  - status enum + labels shared by validation, UI filters, and tests
 *  - the admin list-query where-builder (visibility + filters)
 *
 * No DB access — the helpers feed the API routes, UI components, and
 * tests so the rule lives in one place.
 */

export const UNIVERSITY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type UniversityStatus = (typeof UNIVERSITY_STATUSES)[number];

export const UNIVERSITY_STATUS_LABELS: Record<UniversityStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export const UNIVERSITY_SORT_KEYS = [
  "name",
  "ranking",
  "applicationFee",
  "status",
  "createdAt",
] as const;
export type UniversitySortKey = (typeof UNIVERSITY_SORT_KEYS)[number];

/**
 * Normalize a university name into a URL-safe slug. Lowercases, replaces
 * non-alphanumeric runs with single dashes, trims leading/trailing dashes.
 * Returns an empty string for nullish/blank input.
 *
 * Note: the actual slug stored in the DB is `${slugify(name)}-${timestamp36}`
 * to guarantee uniqueness. This helper is used for the name→slug derivation
 * part only; the timestamp suffix is added in the POST handler.
 */
export function normalizeSlug(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pure guard: returns a human-readable reason when a university cannot be
 * archived, or null when archiving is allowed. Mirrors the server-side
 * check in `app/api/universities/[id]/route.ts` so the UI can pre-flight
 * without round-tripping. Active applications block archiving because
 * the university is part of in-flight applications' identity.
 */
export function archiveBlockReason(university: {
  status?: string | null;
  deletedAt?: Date | string | null;
  _count?: { applications?: number } | null;
}): string | null {
  if (university.deletedAt) return "University is already archived";
  const active = university._count?.applications ?? 0;
  if (active > 0) {
    return `${active} active application(s) reference this university — deactivate it instead of archiving`;
  }
  return null;
}

/**
 * Build a Prisma `where` fragment for the admin university list. Enforces
 * the soft-delete filter (deletedAt null vs not-null based on the
 * `archived` toggle) and AND-combines the optional discovery filters:
 * search (name OR city OR country name), countryId, status.
 *
 * The archived toggle is the primary visibility switch — admins see
 * either active OR archived universities, never both in the same query.
 */
export function buildAdminUniversityWhere(filters: {
  search?: string;
  countryId?: string;
  status?: string;
  archived?: boolean;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [
    { deletedAt: filters.archived ? { not: null } : null },
  ];

  if (filters.status) {
    andClauses.push({ status: filters.status });
  }
  if (filters.countryId) {
    andClauses.push({ countryId: filters.countryId });
  }
  if (search) {
    andClauses.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { country: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: andClauses };
}

/**
 * Format an application fee for display. Uses Intl.NumberFormat with a
 * safe fallback for invalid currency codes — never throws.
 */
export function formatFee(
  fee: number | null | undefined,
  currency = "USD",
): string {
  if (fee == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(fee);
  } catch {
    return `${currency} ${fee.toLocaleString("en-US")}`.trim();
  }
}

/**
 * Validate a slug suffix. The admin can't set slugs directly (they're
 * derived from the name + a uniqueness timestamp), but this helper
 * exists so tests can verify the slug derivation contract.
 */
export function isValidSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  // Lowercase letters, digits, dashes only. Must not start/end with a dash.
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
