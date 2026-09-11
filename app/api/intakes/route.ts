import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { intakeSchema, paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { buildAdminIntakeWhere } from "@/lib/constants/courses-admin";

/**
 * Admin intake list endpoint.
 *
 * Returns intakes with the soft-delete filter driven by the
 * `?archived=true` toggle. Server-side search spans intake name,
 * course name, and university name. Filters: countryId, universityId,
 * courseId, status. Sorting via the `sortFrom` allow-list
 * (name, year, month, deadline, status, createdAt).
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

    const where = buildAdminIntakeWhere({
      search: params.search,
      countryId: sp.get("countryId") ?? undefined,
      universityId: sp.get("universityId") ?? undefined,
      courseId: sp.get("courseId") ?? undefined,
      status: params.status,
      archived,
    });

    const [data, total] = await Promise.all([
      prisma.intake.findMany({
        where,
        include: {
          course: {
            select: {
              id: true,
              name: true,
              degreeLevel: true,
              university: {
                select: {
                  id: true,
                  name: true,
                  country: { select: { id: true, name: true, flag: true } },
                },
              },
            },
          },
          _count: {
            select: { applications: { where: { deletedAt: null } } },
          },
        },
        orderBy: sortFrom(sp, ["name", "year", "month", "deadline", "status", "createdAt"], {
          year: "desc",
          month: "desc",
        }),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.intake.count({ where }),
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
    const g = await guard("intakes.manage");
    if (g.error) return g.error;
    const body = intakeSchema.parse(await req.json());

    // Validate that the referenced course exists and is not archived.
    const course = await prisma.course.findFirst({
      where: { id: body.courseId, deletedAt: null },
    });
    if (!course) return fail("NOT_FOUND", "Course not found", 404);

    const intake = await prisma.intake.create({ data: body });
    await auditLog.record({
      userId: g.user.id,
      action: "intake.created",
      entity: "Intake",
      entityId: intake.id,
      newValue: {
        name: body.name,
        courseId: body.courseId,
        month: body.month,
        year: body.year,
        deadline: body.deadline,
      },
    });
    return ok(intake, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
