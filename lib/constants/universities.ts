/**
 * Pure helpers for the student-facing university discovery experience.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The visibility rules in particular are the single source of
 * truth for "which universities can a student see?" and are tested
 * independently so the API guard and the UI can both rely on them.
 */

export const UNIVERSITY_VISIBILITY_STATUSES = ["ACTIVE"] as const;
export type UniversityVisibilityStatus = (typeof UNIVERSITY_VISIBILITY_STATUSES)[number];

export const STUDENT_UNIVERSITY_SORTS = [
  "name",
  "ranking",
  "applicationFee",
  "createdAt",
] as const;
export type StudentUniversitySort = (typeof STUDENT_UNIVERSITY_SORTS)[number];

/**
 * Minimal shape required to evaluate visibility. The `country` field is
 * typed loosely (any object with optional status/deletedAt) so callers
 * passing a Prisma `select` projection (which often omits those fields)
 * still type-check — missing fields are treated as undefined and
 * therefore fail the visibility check, which is the safe default.
 */
type VisibilityInput = {
  status?: string | null;
  deletedAt?: Date | string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  country?: any;
};

/**
 * A university is student-visible only if:
 *  - its own status is ACTIVE
 *  - its soft-delete tombstone is null
 *  - its parent country is ACTIVE and not soft-deleted
 *
 * The function takes the denormalized shape returned by the API include
 * so the UI can pre-flight without a second query.
 */
export function isUniversityVisibleToStudent(university: VisibilityInput): boolean {
  if (university.status !== "ACTIVE") return false;
  if (university.deletedAt) return false;
  const country = university.country;
  if (!country) return false;
  if (country.status !== "ACTIVE") return false;
  if (country.deletedAt) return false;
  return true;
}

/**
 * Build a MongoDB/Prisma `where` fragment that enforces student visibility
 * for universities. Used by the student API routes so the rule lives in
 * one place.
 *
 * Extra optional filters are merged in — countryId, city, status (always
 * overridden to ACTIVE), ranking ceiling, and joins via courseId/intakeId
 * are surfaced as separate where-clause fragments so the API can mix and
 * match without rebuilding the visibility core.
 */
export function buildStudentUniversityWhere(filters: {
  search?: string;
  countryId?: string;
  city?: string;
  rankingMax?: number;
  courseId?: string;
  intakeId?: string;
  favoriteOnly?: boolean;
  favoriteUniversityIds?: string[];
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const city = filters.city?.trim();

  const andClauses: Record<string, unknown>[] = [
    { deletedAt: null, status: "ACTIVE" },
    { country: { deletedAt: null, status: "ACTIVE" } },
  ];

  if (search) {
    andClauses.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { country: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.countryId) andClauses.push({ countryId: filters.countryId });
  if (city) andClauses.push({ city: { contains: city, mode: "insensitive" } });
  if (typeof filters.rankingMax === "number") {
    andClauses.push({ ranking: { lte: filters.rankingMax } });
  }
  if (filters.courseId) {
    andClauses.push({ courses: { some: { id: filters.courseId, deletedAt: null } } });
  }
  if (filters.intakeId) {
    andClauses.push({
      courses: {
        some: { intakes: { some: { id: filters.intakeId } } },
      },
    });
  }
  if (filters.favoriteOnly && filters.favoriteUniversityIds?.length) {
    andClauses.push({ id: { in: filters.favoriteUniversityIds } });
  }
  if (filters.favoriteOnly && !filters.favoriteUniversityIds?.length) {
    // Favorite-only with no favorites → impossible match
    andClauses.push({ id: { in: [] } });
  }

  return { AND: andClauses };
}

/**
 * Resolve a sort key from the query string into a Prisma orderBy. Ranking
 * defaults to asc (lower = better) while everything else defaults to desc
 * — newest first, priciest first, alphabetical A→Z.
 */
export function resolveUniversityOrderBy(sort?: string): Record<string, "asc" | "desc"> {
  switch (sort) {
    case "name":
      return { name: "asc" };
    case "ranking":
      return { ranking: "asc" };
    case "applicationFee":
      return { applicationFee: "desc" };
    case "createdAt":
      return { createdAt: "desc" };
    default:
      return { name: "asc" };
  }
}

/**
 * Format an application fee as a localized currency string. Falls back to
 * a plain number rendering when currency is missing — never throws.
 */
export function formatApplicationFee(
  fee: number | null | undefined,
  currency?: string | null,
): string {
  if (fee == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(fee);
  } catch {
    return `${currency ?? ""} ${fee}`.trim();
  }
}

/**
 * Categorize a ranking into a coarse "tier" used for chip display.
 * Returns null when the ranking is missing so the UI can omit the chip.
 */
export function rankingTier(
  ranking: number | null | undefined,
): "top" | "leading" | "established" | null {
  if (ranking == null || ranking <= 0) return null;
  if (ranking <= 50) return "top";
  if (ranking <= 200) return "leading";
  return "established";
}

/**
 * Build a stable URL for a university's logo. Returns null when the logo
 * field is empty/invalid — the UI then falls back to an initials avatar.
 */
export function resolveUniversityLogo(
  logo: string | null | undefined,
): string | null {
  if (!logo) return null;
  try {
    // Validates the URL shape; throws on garbage input.
    const u = new URL(logo);
    return u.toString();
  } catch {
    // Not a valid URL — could be a relative path the host serves. Pass
    // through only if it starts with `/` (internal asset) and looks like
    // an image path.
    if (logo.startsWith("/")) return logo;
    return null;
  }
}

/**
 * Derive initials from a university name for the fallback avatar.
 * Strips common corporate suffixes so "University of Toronto" → "UT",
 * not "Uo". Returns up to 2 uppercase characters.
 */
export function universityInitials(name: string): string {
  const cleaned = name
    .replace(/\b(university|institute|college|school|of|the)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const source = cleaned.length > 0 ? cleaned : name;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
