import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";

/**
 * Employee University Discovery service — server-side data layer for
 * /employee/universities (list) and /employee/universities/[id] (detail).
 *
 * Universities are global catalog records — every employee sees all
 * ACTIVE universities (no case-ownership filter needed). The service
 * is read-only for employees; write access requires universities.manage
 * (ADMIN only).
 *
 * The list query joins Country + counts Courses + counts active Intakes
 * in a single findMany with `_count` — no N+1.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type UniversityListFilters = {
  search?: string;
  countryId?: string;
  status?: string;
  rankingMax?: number;
  intakeAvailable?: boolean;
};

export type UniversityRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  website: string | null;
  description: string | null;
  ranking: number | null;
  status: string;
  country: { id: string; name: string; flag: string | null } | null;
  courseCount: number;
  activeIntakeCount: number;
  applicationFee: number | null;
};

export type UniversityListResult = {
  rows: UniversityRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type UniversityDetail = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  website: string | null;
  description: string | null;
  ranking: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  country: { id: string; name: string; flag: string | null; currency: string | null };
  courses: {
    id: string;
    name: string;
    degreeLevel: string;
    duration: string | null;
    tuitionFee: number | null;
    currency: string;
    description: string | null;
    status: string;
    intakes: {
      id: string; name: string; month: number; year: number; deadline: Date | null; status: string;
    }[];
    _count: { applications: number };
  }[];
  applications: {
    id: string; applicationNumber: string; stageKey: string; status: string;
    student: { id: string; firstName: string; lastName: string; studentId: string };
  }[];
};

// ─────────────────────────────────────────────
// List — paginated with search + filters
// ─────────────────────────────────────────────

export async function listUniversities(
  params: {
    filters?: UniversityListFilters;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<UniversityListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};

  // Default: only ACTIVE universities are visible to employees
  const statusFilter = filters.status ? { status: filters.status } : { status: "ACTIVE" };

  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { slug: { contains: search, mode: "insensitive" as const } },
          { city: { contains: search, mode: "insensitive" as const } },
          { country: { name: { contains: search, mode: "insensitive" as const } } },
          { country: { code: { contains: search.toUpperCase(), mode: "insensitive" as const } } },
        ],
      }
    : {};

  const countryFilter = filters.countryId ? { countryId: filters.countryId } : {};

  const rankingFilter = filters.rankingMax ? { ranking: { lte: filters.rankingMax } } : {};

  const where = { ...statusFilter, ...searchFilter, ...countryFilter, ...rankingFilter };

  const [rows, total] = await Promise.all([
    prisma.university.findMany({
      where,
      orderBy: [{ ranking: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, slug: true, city: true, website: true,
        description: true, ranking: true, status: true,
        country: { select: { id: true, name: true, flag: true } },
        courses: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            intakes: { where: { status: "ACTIVE" }, select: { id: true } },
          },
        },
      },
    }),
    prisma.university.count({ where }),
  ]);

  const mapped: UniversityRow[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    slug: u.slug,
    city: u.city,
    website: u.website,
    description: u.description,
    ranking: u.ranking,
    status: u.status,
    country: u.country,
    courseCount: u.courses.length,
    activeIntakeCount: u.courses.reduce((sum, c) => sum + c.intakes.length, 0),
    applicationFee: null, // University has no applicationFee field; surfaced from Course if needed
  }));

  // If intakeAvailable filter is set, filter in JS (Prisma can't count across relations in a where clause)
  const finalRows = filters.intakeAvailable
    ? mapped.filter((u) => u.activeIntakeCount > 0)
    : mapped;

  return {
    rows: finalRows,
    total: filters.intakeAvailable ? finalRows.length : total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((filters.intakeAvailable ? finalRows.length : total) / pageSize)),
  };
}

// ─────────────────────────────────────────────
// Detail — single university with all related data
// ─────────────────────────────────────────────

export async function getUniversityById(id: string): Promise<UniversityDetail | null> {
  const uni = await prisma.university.findFirst({
    where: { id },
    select: {
      id: true, name: true, slug: true, city: true, website: true,
      description: true, ranking: true, status: true,
      createdAt: true, updatedAt: true,
      country: { select: { id: true, name: true, flag: true, currency: true } },
      courses: {
        where: { status: "ACTIVE" },
        orderBy: [{ degreeLevel: "asc" }, { name: "asc" }],
        select: {
          id: true, name: true, degreeLevel: true, duration: true,
          tuitionFee: true, currency: true, description: true, status: true,
          intakes: {
            where: { status: "ACTIVE" },
            orderBy: [{ year: "asc" }, { month: "asc" }],
            select: { id: true, name: true, month: true, year: true, deadline: true, status: true },
          },
          _count: { select: { applications: true } },
        },
      },
      applications: {
        where: { archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true, applicationNumber: true, stageKey: true, status: true,
          student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        },
      },
    },
  });

  return uni;
}

export async function requireUniversity(id: string): Promise<UniversityDetail> {
  const uni = await getUniversityById(id);
  if (!uni) throw new HttpError(404, "NOT_FOUND", "University not found");
  return uni;
}
