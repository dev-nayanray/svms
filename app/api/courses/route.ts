import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { courseSchema, paginationSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils/slug";
import { auditLog } from "@/lib/services/audit";
import { buildAdminCourseWhere } from "@/lib/constants/courses-admin";

/**
 * Admin course list endpoint.
 *
 * Returns courses with the soft-delete filter driven by the
 * `?archived=true` toggle. Server-side search spans course name,
 * university name, and country name. Filters: countryId, universityId,
 * degreeLevel, tuitionMin/tuitionMax (range), englishTest
 * (ielts/toefl/pte/any), intakeId, status. Sorting via the `sortFrom`
 * allow-list.
 *
 * Each row includes `_count` for active intakes and applications so the
 * admin list can show relationship counts without N+1 queries.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("courses.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    const archived = sp.get("archived") === "true";
    const tuitionMin = sp.get("tuitionMin") ? Number(sp.get("tuitionMin")) : undefined;
    const tuitionMax = sp.get("tuitionMax") ? Number(sp.get("tuitionMax")) : undefined;

    const where = buildAdminCourseWhere({
      search: params.search,
      countryId: sp.get("countryId") ?? undefined,
      universityId: sp.get("universityId") ?? undefined,
      degreeLevel: sp.get("degreeLevel") ?? undefined,
      tuitionMin,
      tuitionMax,
      englishTest: sp.get("englishTest") ?? undefined,
      intakeId: sp.get("intakeId") ?? undefined,
      status: params.status,
      archived,
    });

    const [data, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          university: {
            select: {
              id: true,
              name: true,
              country: { select: { id: true, name: true, flag: true } },
            },
          },
          _count: {
            select: {
              intakes: { where: { status: "ACTIVE", deletedAt: null } },
              applications: { where: { deletedAt: null, status: "ACTIVE" } },
            },
          },
        },
        orderBy: sortFrom(sp, ["name", "tuitionFee", "degreeLevel", "status", "createdAt"], {
          name: "asc",
        }),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.course.count({ where }),
    ]);
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

export async function POST(req: NextRequest) {
  try {
    const g = await guard("courses.manage");
    if (g.error) return g.error;
    const body = courseSchema.parse(await req.json());

    // Validate that the referenced university exists and is not archived.
    const uni = await prisma.university.findFirst({
      where: { id: body.universityId, deletedAt: null },
    });
    if (!uni) return fail("NOT_FOUND", "University not found", 404);

    const slug = `${slugify(body.name)}-${Date.now().toString(36)}`;
    const course = await prisma.course.create({ data: { ...body, slug } });
    await auditLog.record({
      userId: g.user.id,
      action: "course.created",
      entity: "Course",
      entityId: course.id,
      newValue: {
        name: body.name,
        degreeLevel: body.degreeLevel,
        universityId: body.universityId,
        tuitionFee: body.tuitionFee,
      },
    });
    return ok(course, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
