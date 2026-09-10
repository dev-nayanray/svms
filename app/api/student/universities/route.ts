import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { studentUniversityQuerySchema } from "@/lib/validations";
import {
  buildStudentUniversityWhere,
  resolveUniversityOrderBy,
} from "@/lib/constants/universities";

/**
 * Student-facing university discovery endpoint.
 *
 * Visibility rule (single source of truth in
 * `lib/constants/universities.ts`): only universities with `status: ACTIVE`
 * AND a non-archived, ACTIVE parent country are returned. Deleted
 * universities and universities in deactivated countries are filtered out
 * at the DB level so the response is safe to cache client-side.
 *
 * Search is server-side and case-insensitive across name, city, and
 * country name. Filters (country, city, ranking ceiling, course, intake,
 * favorite-only) are AND-combined.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("universities.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const params = studentUniversityQuerySchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: Math.min(Number(sp.get("pageSize") ?? 12), 24),
      search: sp.get("search") ?? undefined,
      status: undefined, // students can't filter by status — always ACTIVE
      countryId: sp.get("countryId") ?? undefined,
      city: sp.get("city") ?? undefined,
      rankingMax: sp.get("rankingMax") ?? undefined,
      courseId: sp.get("courseId") ?? undefined,
      intakeId: sp.get("intakeId") ?? undefined,
      favoriteOnly: sp.get("favoriteOnly") === "true" ? true : undefined,
      sortBy: sp.get("sortBy") ?? undefined,
    });

    // Resolve the student's favorites so we can mark them on the cards and
    // honor the `favoriteOnly` filter.
    let favoriteUniversityIds: string[] = [];
    if (g.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: g.user.id },
        select: {
          universityFavorites: { select: { universityId: true } },
        },
      });
      favoriteUniversityIds = (student?.universityFavorites ?? []).map(
        (f) => f.universityId,
      );
    }

    const where = buildStudentUniversityWhere({
      search: params.search,
      countryId: params.countryId,
      city: params.city,
      rankingMax: params.rankingMax,
      courseId: params.courseId,
      intakeId: params.intakeId,
      favoriteOnly: params.favoriteOnly,
      favoriteUniversityIds,
    });

    const orderBy = resolveUniversityOrderBy(params.sortBy);

    const [rows, total] = await Promise.all([
      prisma.university.findMany({
        where,
        include: {
          country: { select: { id: true, name: true, flag: true } },
          _count: {
            select: {
              courses: { where: { deletedAt: null, status: "ACTIVE" } },
            },
          },
        },
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.university.count({ where }),
    ]);

    const data = rows.map(({ _count, ...u }) => ({
      ...u,
      courseCount: _count.courses,
      isFavorite: favoriteUniversityIds.includes(u.id),
    }));

    return ok({
      data,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / params.pageSize), 1),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
