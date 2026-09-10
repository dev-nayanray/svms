/**
 * Pure helpers for the Admin Course & Intake Management module.
 *
 * These functions are the single source of truth for:
 *  - the admin course list where-builder (visibility + filters)
 *  - the admin intake list where-builder
 *  - the course archive guard (courses with active applications cannot be
 *    archived — they must be deactivated instead)
 *  - the intake archive guard (intakes with applications cannot be
 *    archived — they must be deactivated instead)
 *  - status enum + labels shared by validation, UI filters, and tests
 *
 * No DB access — the helpers feed the API routes, UI components, and
 * tests so the rule lives in one place.
 */

export const COURSE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export const ADMIN_COURSE_SORT_KEYS = [
  "name",
  "tuitionFee",
  "degreeLevel",
  "status",
  "createdAt",
] as const;
export type AdminCourseSortKey = (typeof ADMIN_COURSE_SORT_KEYS)[number];

export const ADMIN_INTAKE_SORT_KEYS = [
  "name",
  "year",
  "month",
  "deadline",
  "status",
  "createdAt",
] as const;
export type AdminIntakeSortKey = (typeof ADMIN_INTAKE_SORT_KEYS)[number];

export const INTAKE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/**
 * English-test filter values supported by the admin course list. "any"
 * matches courses that have at least one of IELTS/TOEFL/PTE populated.
 */
export const ENGLISH_TEST_FILTERS = ["ielts", "toefl", "pte", "any"] as const;
export type EnglishTestFilter = (typeof ENGLISH_TEST_FILTERS)[number];

/**
 * Build a Prisma `where` fragment for the admin course list. Enforces the
 * soft-delete filter (deletedAt null vs not-null based on the `archived`
 * toggle) and AND-combines the optional discovery filters:
 *  - search (course name OR university name OR country name)
 *  - countryId (via university.country)
 *  - universityId
 *  - degreeLevel
 *  - tuitionMin / tuitionMax (numeric range on `tuitionFee`)
 *  - englishTest (ielts/toefl/pte/any — filters to courses with the
 *    specified English-test requirement populated)
 *  - intakeId (course has at least one matching intake)
 */
export function buildAdminCourseWhere(filters: {
  search?: string;
  countryId?: string;
  universityId?: string;
  degreeLevel?: string;
  tuitionMin?: number;
  tuitionMax?: number;
  englishTest?: string;
  intakeId?: string;
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
  if (filters.degreeLevel) {
    andClauses.push({ degreeLevel: filters.degreeLevel });
  }
  if (filters.universityId) {
    andClauses.push({ universityId: filters.universityId });
  }
  if (filters.countryId) {
    andClauses.push({ university: { countryId: filters.countryId } });
  }
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
  if (typeof filters.tuitionMin === "number" || typeof filters.tuitionMax === "number") {
    const range: Record<string, unknown> = {};
    if (typeof filters.tuitionMin === "number") range.gte = filters.tuitionMin;
    if (typeof filters.tuitionMax === "number") range.lte = filters.tuitionMax;
    andClauses.push({ tuitionFee: range });
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
  if (filters.intakeId) {
    andClauses.push({
      intakes: { some: { id: filters.intakeId } },
    });
  }

  return { AND: andClauses };
}

/**
 * Build a Prisma `where` fragment for the admin intake list. Enforces the
 * soft-delete filter and AND-combines the optional discovery filters:
 *  - search (intake name OR course name OR university name)
 *  - countryId (via course.university.country)
 *  - universityId (via course.university)
 *  - courseId
 *  - status
 */
export function buildAdminIntakeWhere(filters: {
  search?: string;
  countryId?: string;
  universityId?: string;
  courseId?: string;
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
  if (filters.courseId) {
    andClauses.push({ courseId: filters.courseId });
  }
  if (filters.universityId) {
    andClauses.push({ course: { universityId: filters.universityId } });
  }
  if (filters.countryId) {
    andClauses.push({
      course: { university: { countryId: filters.countryId } },
    });
  }
  if (search) {
    andClauses.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { course: { name: { contains: search, mode: "insensitive" } } },
        {
          course: {
            university: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  return { AND: andClauses };
}

/**
 * Pure guard: returns a human-readable reason when a course cannot be
 * archived, or null when archiving is allowed. Active applications block
 * archiving because the course is part of in-flight applications'
 * identity.
 */
export function courseArchiveBlockReason(course: {
  status?: string | null;
  deletedAt?: Date | string | null;
  _count?: { applications?: number } | null;
}): string | null {
  if (course.deletedAt) return "Course is already archived";
  const active = course._count?.applications ?? 0;
  if (active > 0) {
    return `${active} active application(s) reference this course — deactivate it instead of archiving`;
  }
  return null;
}

/**
 * Pure guard: returns a human-readable reason when an intake cannot be
 * archived, or null when archiving is allowed. Applications referencing
 * the intake block archiving — the admin must deactivate instead.
 */
export function intakeArchiveBlockReason(intake: {
  deletedAt?: Date | string | null;
  _count?: { applications?: number } | null;
}): string | null {
  if (intake.deletedAt) return "Intake is already archived";
  const count = intake._count?.applications ?? 0;
  if (count > 0) {
    return `${count} application(s) reference this intake — deactivate it instead of archiving`;
  }
  return null;
}

/**
 * Format a tuition fee for display. Uses Intl.NumberFormat with a safe
 * fallback for invalid currency codes — never throws.
 */
export function formatTuition(
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
 * Derive a human-readable "start date" label from an intake's month +
 * year. Returns "—" when month or year is missing/invalid.
 */
export function intakeStartLabel(
  month: number | null,
  year: number | null,
): string {
  if (!month || !year) return "—";
  if (month < 1 || month > 12) return "—";
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
