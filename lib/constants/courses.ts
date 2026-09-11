/**
 * Pure helpers for the student-facing course discovery experience.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The visibility rule is the single source of truth for "which
 * courses can a student see?" and is enforced at the DB level in every
 * student-facing query.
 *
 * A course is student-visible only if:
 *  - the course itself has status ACTIVE and is not soft-deleted
 *  - its parent university has status ACTIVE and is not soft-deleted
 *  - the university's parent country has status ACTIVE and is not soft-deleted
 *
 * The chained visibility (course → university → country) is enforced at
 * the DB level via nested Prisma where fragments so a single round-trip
 * filters out invisible courses. The pure `isCourseVisibleToStudent`
 * helper mirrors that check for UI pre-flight and unit tests.
 */

export const COURSE_DEGREE_LEVELS = [
  "DIPLOMA",
  "BACHELOR",
  "MASTER",
  "PHD",
  "OTHER",
] as const;
export type CourseDegreeLevel = (typeof COURSE_DEGREE_LEVELS)[number];

export const COURSE_DEGREE_LABELS: Record<CourseDegreeLevel, string> = {
  DIPLOMA: "Diploma",
  BACHELOR: "Bachelor",
  MASTER: "Master",
  PHD: "PhD",
  OTHER: "Other",
};

export const STUDENT_COURSE_SORTS = [
  "name",
  "tuitionFee",
  "degreeLevel",
  "createdAt",
] as const;
export type StudentCourseSort = (typeof STUDENT_COURSE_SORTS)[number];

export const INTAKE_URGENCY_THRESHOLDS = {
  /** Days until a deadline is considered "soon" (amber). */
  soonDays: 30,
  /** Days until a deadline is considered "urgent" (red). */
  urgentDays: 7,
} as const;

export type IntakeUrgency = "urgent" | "soon" | "normal" | "past" | "none";

/**
 * Loose input shape for the visibility check — accepts either a denormalized
 * course (with `university.country` embedded) or a Prisma select projection.
 * Missing nested fields are treated as failing the visibility check, which
 * is the safe default (deny-by-default).
 */
type CourseVisibilityInput = {
  status?: string | null;
  deletedAt?: Date | string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  university?: any;
};

/**
 * Returns true only if the course, its university, and the university's
 * country are all ACTIVE and not soft-deleted. Used by the API guards and
 * the UI pre-flight. Mirrors the DB-level `buildStudentCourseWhere` rule.
 */
export function isCourseVisibleToStudent(course: CourseVisibilityInput): boolean {
  if (course.status !== "ACTIVE") return false;
  if (course.deletedAt) return false;
  const uni = course.university;
  if (!uni) return false;
  if (uni.status !== "ACTIVE") return false;
  if (uni.deletedAt) return false;
  const country = uni.country;
  if (!country) return false;
  if (country.status !== "ACTIVE") return false;
  if (country.deletedAt) return false;
  return true;
}

/**
 * Build a Prisma `where` fragment enforcing student visibility for courses.
 * The visibility chain (course → university → country) is expressed via
 * nested AND clauses so a single DB round-trip filters out invisible
 * courses. Optional discovery filters are AND-combined on top.
 *
 * Filters supported:
 *  - search: case-insensitive contains across course name, university
 *    name, and country name (OR-combined)
 *  - countryId, universityId: exact-match scalars
 *  - degreeLevel: enum-string exact match
 *  - tuitionMin / tuitionMax: numeric range on `tuitionFee`
 *  - intakeId: course has at least one matching active intake
 *  - englishTest: filters to courses that have *any* of IELTS/TOEFL/PTE
 *    requirements populated when set to "any", or the specific test when
 *    set to "ielts" / "toefl" / "pte"
 */
export function buildStudentCourseWhere(filters: {
  search?: string;
  countryId?: string;
  universityId?: string;
  degreeLevel?: string;
  tuitionMin?: number;
  tuitionMax?: number;
  intakeId?: string;
  englishTest?: string;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [
    { deletedAt: null, status: "ACTIVE" },
    {
      university: {
        deletedAt: null,
        status: "ACTIVE",
        country: { deletedAt: null, status: "ACTIVE" },
      },
    },
  ];

  if (search) {
    andClauses.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { university: { name: { contains: search, mode: "insensitive" } } },
        {
          university: {
            country: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    });
  }
  if (filters.countryId) {
    andClauses.push({ university: { countryId: filters.countryId } });
  }
  if (filters.universityId) andClauses.push({ universityId: filters.universityId });
  if (filters.degreeLevel) andClauses.push({ degreeLevel: filters.degreeLevel });

  // Tuition range — both bounds are inclusive. A null tuitionFee on a
  // course means "contact us" — it never matches a range filter, which
  // is the intended behaviour (students filtering by tuition want
  // concrete numbers).
  if (typeof filters.tuitionMin === "number" || typeof filters.tuitionMax === "number") {
    const range: Record<string, unknown> = {};
    if (typeof filters.tuitionMin === "number") range.gte = filters.tuitionMin;
    if (typeof filters.tuitionMax === "number") range.lte = filters.tuitionMax;
    andClauses.push({ tuitionFee: range });
  }

  if (filters.intakeId) {
    andClauses.push({
      intakes: { some: { id: filters.intakeId, status: "ACTIVE" } },
    });
  }

  if (filters.englishTest) {
    const test = filters.englishTest.toLowerCase();
    if (test === "ielts") {
      andClauses.push({ ieltsRequirement: { not: null } });
    } else if (test === "toefl") {
      andClauses.push({ toeflRequirement: { not: null } });
    } else if (test === "pte") {
      andClauses.push({ pteRequirement: { not: null } });
    } else if (test === "any") {
      andClauses.push({
        OR: [
          { ieltsRequirement: { not: null } },
          { toeflRequirement: { not: null } },
          { pteRequirement: { not: null } },
        ],
      });
    }
  }

  return { AND: andClauses };
}

/**
 * Resolve a sort key from the query string into a Prisma orderBy. Tuition
 * defaults to asc (cheapest first) so students on a budget see affordable
 * options first; everything else defaults to asc except createdAt (desc —
 * newest first).
 */
export function resolveCourseOrderBy(sort?: string): Record<string, "asc" | "desc"> {
  switch (sort) {
    case "name":
      return { name: "asc" };
    case "tuitionFee":
      return { tuitionFee: "asc" };
    case "degreeLevel":
      return { degreeLevel: "asc" };
    case "createdAt":
      return { createdAt: "desc" };
    default:
      return { name: "asc" };
  }
}

/**
 * Derive a start-date for an intake from its month + year. Returns the
 * first day of that month (UTC midnight) so the UI can render a single
 * localized date. Returns null when month or year is missing/invalid.
 */
export function intakeStartDate(month: number | null, year: number | null): Date | null {
  if (!month || !year) return null;
  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 3000) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * Format a Date (or ISO string) as a short, locale-aware date. Returns
 * "—" for nullish input. Used for intake start dates and deadlines.
 */
export function formatShortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Compute the urgency of an intake deadline relative to "now". Used by the
 * UI to highlight approaching deadlines with amber/red treatment.
 *
 * Returns:
 *  - "urgent": deadline within INTAKE_URGENCY_THRESHOLDS.urgentDays (7 days)
 *  - "soon":   deadline within INTAKE_URGENCY_THRESHOLDS.soonDays (30 days)
 *  - "normal": deadline more than soonDays away
 *  - "past":    deadline already passed (still useful to show "Closed")
 *  - "none":    deadline is null/unknown
 */
export function intakeDeadlineUrgency(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): IntakeUrgency {
  if (!deadline) return "none";
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (Number.isNaN(d.getTime())) return "none";
  const ms = d.getTime() - now.getTime();
  if (ms < 0) return "past";
  const days = ms / (24 * 60 * 60 * 1000);
  if (days <= INTAKE_URGENCY_THRESHOLDS.urgentDays) return "urgent";
  if (days <= INTAKE_URGENCY_THRESHOLDS.soonDays) return "soon";
  return "normal";
}

/**
 * Format a tuition fee + currency as a localized string. Falls back to a
 * plain number rendering when the currency code is invalid — never throws.
 * Distinct from `formatApplicationFee` in the universities helper because
 * tuition often has decimals (e.g. USD 32,500.00) while application fees
 * are typically whole numbers.
 */
export function formatTuitionFee(
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
    return `${currency ?? ""} ${fee.toLocaleString("en-US")}`.trim();
  }
}

/**
 * Collect the non-null English-test requirements from a course and return
 * them as a sorted array of { test, label, value } tuples for UI display.
 * Tests with no value are omitted entirely.
 */
export function collectEnglishRequirements(course: {
  ieltsRequirement?: string | null;
  toeflRequirement?: string | null;
  pteRequirement?: string | null;
}): { test: string; label: string; value: string }[] {
  const out: { test: string; label: string; value: string }[] = [];
  if (course.ieltsRequirement) {
    out.push({ test: "ielts", label: "IELTS", value: course.ieltsRequirement });
  }
  if (course.toeflRequirement) {
    out.push({ test: "toefl", label: "TOEFL", value: course.toeflRequirement });
  }
  if (course.pteRequirement) {
    out.push({ test: "pte", label: "PTE Academic", value: course.pteRequirement });
  }
  return out;
}

/**
 * True when a course has at least one active intake in the future (relative
 * to "now"). Used by the list view to show an "Open for applications" chip
 * without the UI needing to fetch intakes separately.
 */
export function hasOpenIntake(
  intakes: { deadline?: Date | string | null; status?: string | null }[] | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!intakes || intakes.length === 0) return false;
  return intakes.some((i) => {
    if (i.status && i.status !== "ACTIVE") return false;
    if (!i.deadline) return true; // active intake with no deadline = open
    const d = typeof i.deadline === "string" ? new Date(i.deadline) : i.deadline;
    if (Number.isNaN(d.getTime())) return false;
    return d.getTime() >= now.getTime();
  });
}
