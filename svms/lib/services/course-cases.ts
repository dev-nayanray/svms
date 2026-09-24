import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";

/**
 * Employee Courses + Intakes Discovery service.
 *
 * Read-only for employees — courses and intakes are global catalog records.
 * No case-ownership filter needed; every employee sees all ACTIVE courses.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type CourseListFilters = {
  search?: string;
  countryId?: string;
  universityId?: string;
  degreeLevel?: string;
  tuitionMin?: number;
  tuitionMax?: number;
  intakeId?: string;
  englishTest?: "ielts" | "toefl" | "pte" | "any";
  deadlineFrom?: string;
  deadlineTo?: string;
};

export type CourseSortKey = "name" | "tuitionFee" | "degreeLevel" | "createdAt";

export type CourseRow = {
  id: string;
  name: string;
  degreeLevel: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  ieltsRequirement: string | null;
  toeflRequirement: string | null;
  pteRequirement: string | null;
  status: string;
  university: { id: string; name: string; city: string | null };
  country: { id: string; name: string; flag: string | null } | null;
  activeIntakeCount: number;
  nextDeadline: Date | null;
};

export type CourseListResult = {
  rows: CourseRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CourseDetail = {
  id: string;
  name: string;
  degreeLevel: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  description: string | null;
  academicRequirements: string | null;
  ieltsRequirement: string | null;
  toeflRequirement: string | null;
  pteRequirement: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  university: {
    id: string; name: string; city: string | null; website: string | null;
    country: { id: string; name: string; flag: string | null };
  };
  intakes: {
    id: string; name: string; month: number; year: number; deadline: Date | null; status: string;
  }[];
  applicationCount: number;
};

// ─────────────────────────────────────────────
// List — paginated with search + filters + sort
// ─────────────────────────────────────────────

const SORT_ALLOWLIST: Record<CourseSortKey, Record<string, "asc" | "desc">> = {
  name: { name: "asc" },
  tuitionFee: { tuitionFee: "asc" },
  degreeLevel: { degreeLevel: "asc" },
  createdAt: { createdAt: "desc" },
};

export async function listCourses(
  params: {
    filters?: CourseListFilters;
    page?: number;
    pageSize?: number;
    sortBy?: CourseSortKey;
    sortOrder?: "asc" | "desc";
  } = {},
): Promise<CourseListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};
  const sortBy = params.sortBy ?? "name";
  const sortOrder = params.sortOrder ?? "asc";

  const statusFilter = { status: "ACTIVE" };

  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { university: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const countryFilter = filters.countryId ? { university: { countryId: filters.countryId } } : {};
  const universityFilter = filters.universityId ? { universityId: filters.universityId } : {};
  const degreeFilter = filters.degreeLevel ? { degreeLevel: filters.degreeLevel } : {};

  const tuitionRange: Record<string, unknown> = {};
  if (filters.tuitionMin !== undefined) tuitionRange.gte = filters.tuitionMin;
  if (filters.tuitionMax !== undefined) tuitionRange.lte = filters.tuitionMax;
  const tuitionFilter = Object.keys(tuitionRange).length > 0 ? { tuitionFee: tuitionRange } : {};

  const intakeFilter = filters.intakeId ? { intakes: { some: { id: filters.intakeId } } } : {};

  // English requirement filter — courses that have the specified test requirement
  const englishFilter = filters.englishTest
    ? filters.englishTest === "any"
      ? {
          OR: [
            { ieltsRequirement: { not: null } },
            { toeflRequirement: { not: null } },
            { pteRequirement: { not: null } },
          ],
        }
      : filters.englishTest === "ielts"
        ? { ieltsRequirement: { not: null } }
        : filters.englishTest === "toefl"
          ? { toeflRequirement: { not: null } }
          : { pteRequirement: { not: null } }
    : {};

  // Deadline filter — intakes with deadlines in the given range
  const deadlineRange: Record<string, unknown> = {};
  if (filters.deadlineFrom) {
    const d = new Date(filters.deadlineFrom);
    if (!isNaN(d.getTime())) deadlineRange.gte = d;
  }
  if (filters.deadlineTo) {
    const d = new Date(filters.deadlineTo);
    if (!isNaN(d.getTime())) deadlineRange.lte = d;
  }
  const deadlineFilter = Object.keys(deadlineRange).length > 0
    ? { intakes: { some: { deadline: deadlineRange } } }
    : {};

  const where = {
    ...statusFilter, ...searchFilter, ...countryFilter, ...universityFilter,
    ...degreeFilter, ...tuitionFilter, ...intakeFilter, ...englishFilter, ...deadlineFilter,
  };

  const sortKey = sortBy in SORT_ALLOWLIST ? sortBy : "name";
  const orderBy: Record<string, "asc" | "desc">[] = [{ ...SORT_ALLOWLIST[sortKey] }];
  if (sortOrder === "desc" && sortKey !== "createdAt") {
    const key = Object.keys(orderBy[0])[0];
    orderBy[0] = { [key]: "desc" };
  }
  if (sortOrder === "asc" && sortKey === "createdAt") {
    orderBy[0] = { createdAt: "asc" };
  }

  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, degreeLevel: true, duration: true,
        tuitionFee: true, currency: true, applicationFee: true,
        ieltsRequirement: true, toeflRequirement: true, pteRequirement: true,
        status: true,
        university: {
          select: {
            id: true, name: true, city: true,
            country: { select: { id: true, name: true, flag: true } },
          },
        },
        intakes: {
          where: { status: "ACTIVE" },
          orderBy: { deadline: "asc" },
          select: { id: true, deadline: true },
        },
      },
    }),
    prisma.course.count({ where }),
  ]);

  const mapped: CourseRow[] = rows.map((c) => {
    const deadlines = c.intakes.map((i) => i.deadline).filter((d): d is Date => d !== null);
    const futureDeadlines = deadlines.filter((d) => d > new Date());
    const nextDeadline = futureDeadlines.length > 0
      ? futureDeadlines.sort((a, b) => a.getTime() - b.getTime())[0]
      : null;
    return {
      id: c.id, name: c.name, degreeLevel: c.degreeLevel, duration: c.duration,
      tuitionFee: c.tuitionFee, currency: c.currency, applicationFee: c.applicationFee,
      ieltsRequirement: c.ieltsRequirement, toeflRequirement: c.toeflRequirement,
      pteRequirement: c.pteRequirement, status: c.status,
      university: c.university,
      country: c.university.country,
      activeIntakeCount: c.intakes.length,
      nextDeadline,
    };
  });

  return { rows: mapped, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ─────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────

export async function getCourseById(id: string): Promise<CourseDetail | null> {
  const course = await prisma.course.findFirst({
    where: { id },
    select: {
      id: true, name: true, degreeLevel: true, duration: true,
      tuitionFee: true, currency: true, applicationFee: true,
      description: true, academicRequirements: true,
      ieltsRequirement: true, toeflRequirement: true, pteRequirement: true,
      status: true, createdAt: true, updatedAt: true,
      university: {
        select: {
          id: true, name: true, city: true, website: true,
          country: { select: { id: true, name: true, flag: true } },
        },
      },
      intakes: {
        where: { status: "ACTIVE" },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        select: { id: true, name: true, month: true, year: true, deadline: true, status: true },
      },
      _count: { select: { applications: true } },
    },
  });
  if (!course) return null;
  const { _count, ...rest } = course;
  return { ...rest, applicationCount: _count.applications };
}

export async function requireCourse(id: string): Promise<CourseDetail> {
  const c = await getCourseById(id);
  if (!c) throw new HttpError(404, "NOT_FOUND", "Course not found");
  return c;
}

// ─────────────────────────────────────────────
// Intakes — list with deadline status
// ─────────────────────────────────────────────

export type IntakeRow = {
  id: string;
  name: string;
  month: number;
  year: number;
  deadline: Date | null;
  status: string;
  course: { id: string; name: string; degreeLevel: string };
  university: { id: string; name: string };
  country: { name: string; flag: string | null } | null;
  deadlineStatus: "upcoming" | "closing_soon" | "expired" | "no_deadline";
};

export type IntakeListResult = {
  rows: IntakeRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const CLOSING_SOON_DAYS = 14;

export function computeDeadlineStatus(deadline: Date | null, now: Date = new Date()): IntakeRow["deadlineStatus"] {
  if (!deadline) return "no_deadline";
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs < 0) return "expired";
  if (diffMs < CLOSING_SOON_DAYS * 24 * 60 * 60 * 1000) return "closing_soon";
  return "upcoming";
}

export async function listIntakes(
  params: {
    page?: number;
    pageSize?: number;
    upcomingOnly?: boolean;
    courseId?: string;
    universityId?: string;
    countryId?: string;
  } = {},
): Promise<IntakeListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (params.courseId) where.courseId = params.courseId;
  if (params.universityId) where.course = { universityId: params.universityId };
  if (params.countryId) where.course = { university: { countryId: params.countryId } };
  if (params.upcomingOnly) where.deadline = { gte: new Date() };

  const [rows, total] = await Promise.all([
    prisma.intake.findMany({
      where,
      orderBy: [{ deadline: "asc" }, { year: "asc" }, { month: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, month: true, year: true, deadline: true, status: true,
        course: {
          select: {
            id: true, name: true, degreeLevel: true,
            university: {
              select: {
                id: true, name: true,
                country: { select: { name: true, flag: true } },
              },
            },
          },
        },
      },
    }),
    prisma.intake.count({ where }),
  ]);

  const now = new Date();
  const mapped: IntakeRow[] = rows.map((i) => ({
    id: i.id, name: i.name, month: i.month, year: i.year, deadline: i.deadline, status: i.status,
    course: { id: i.course.id, name: i.course.name, degreeLevel: i.course.degreeLevel },
    university: { id: i.course.university.id, name: i.course.university.name },
    country: i.course.university.country,
    deadlineStatus: computeDeadlineStatus(i.deadline, now),
  }));

  return { rows: mapped, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
