import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { studentCourseQuerySchema } from "@/lib/validations";
import {
  buildStudentCourseWhere,
  resolveCourseOrderBy,
  collectEnglishRequirements,
  hasOpenIntake,
} from "@/lib/constants/courses";

/**
 * Student-facing course discovery endpoint.
 *
 * Visibility rule (single source of truth in `lib/constants/courses.ts`):
 * only courses with `status: ACTIVE` AND a non-archived ACTIVE parent
 * university AND a non-archived ACTIVE grandparent country are returned.
 * Deleted, inactive, or cascaded-invisible courses are filtered out at
 * the DB level so the response is safe to cache client-side.
 *
 * Search is server-side and case-insensitive across course name,
 * university name, and country name. Filters (country, university,
 * degree, tuition range, intake, englishTest) are AND-combined.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("courses.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const params = studentCourseQuerySchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: Math.min(Number(sp.get("pageSize") ?? 12), 24),
      search: sp.get("search") ?? undefined,
      status: undefined, // students can't filter by status — always ACTIVE
      countryId: sp.get("countryId") ?? undefined,
      universityId: sp.get("universityId") ?? undefined,
      degreeLevel: sp.get("degreeLevel") ?? undefined,
      tuitionMin: sp.get("tuitionMin") ?? undefined,
      tuitionMax: sp.get("tuitionMax") ?? undefined,
      intakeId: sp.get("intakeId") ?? undefined,
      englishTest: sp.get("englishTest") ?? undefined,
      sortBy: sp.get("sortBy") ?? undefined,
    });

    const where = buildStudentCourseWhere({
      search: params.search,
      countryId: params.countryId,
      universityId: params.universityId,
      degreeLevel: params.degreeLevel,
      tuitionMin: params.tuitionMin,
      tuitionMax: params.tuitionMax,
      intakeId: params.intakeId,
      englishTest: params.englishTest,
    });

    const orderBy = resolveCourseOrderBy(params.sortBy);

    const [rows, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          university: {
            select: {
              id: true,
              name: true,
              logo: true,
              country: { select: { id: true, name: true, flag: true } },
            },
          },
          intakes: {
            where: { status: "ACTIVE" },
            select: { id: true, deadline: true, status: true },
            orderBy: [{ year: "asc" }, { month: "asc" }],
          },
        },
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.course.count({ where }),
    ]);

    // Strip internal admin fields + enrich with derived UI fields.
    const data = rows.map((c) => {
      const { deletedAt: _d, deletedBy: _b, ...publicCourse } = c;
      void _d;
      void _b;
      return {
        ...publicCourse,
        englishRequirementsList: collectEnglishRequirements(publicCourse),
        hasOpenIntake: hasOpenIntake(publicCourse.intakes),
        activeIntakeCount: publicCourse.intakes.length,
      };
    });

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
