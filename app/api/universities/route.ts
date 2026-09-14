import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { universitySchema, paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { normalizeSlug, buildAdminUniversityWhere } from "@/lib/constants/universities-admin";

/**
 * Admin university list endpoint.
 *
 * Returns universities with the soft-delete filter driven by the
 * `?archived=true` toggle. Server-side search spans name, city, and
 * country name. Filters: countryId, status. Sorting via the `sortFrom`
 * allow-list (name, ranking, applicationFee, status, createdAt).
 *
 * Each row includes `_count` for courses and active applications so the
 * admin list can show relationship counts without N+1 queries.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("universities.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    const archived = sp.get("archived") === "true";

    const where = buildAdminUniversityWhere({
      search: params.search,
      countryId: sp.get("countryId") ?? undefined,
      status: params.status,
      archived,
    });

    const [data, total] = await Promise.all([
      prisma.university.findMany({
        where,
        include: {
          country: { select: { id: true, name: true, flag: true } },
          _count: {
            select: {
              courses: { where: { deletedAt: null } },
              applications: { where: { deletedAt: null, status: "ACTIVE" } },
            },
          },
        },
        orderBy: sortFrom(sp, ["name", "ranking", "applicationFee", "status", "createdAt"], {
          name: "asc",
        }),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.university.count({ where }),
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
    const g = await guard("universities.manage");
    if (g.error) return g.error;
    const body = universitySchema.parse(await req.json());

    // Validate that the referenced country exists and is not archived.
    const country = await prisma.country.findFirst({
      where: { id: body.countryId, deletedAt: null },
    });
    if (!country) return fail("NOT_FOUND", "Country not found", 404);

    // Dedupe-check name within the same country (case-insensitive). Two
    // different universities in different countries CAN share a name
    // (e.g. "University of Toronto" exists in Canada and the US), but
    // within a single country the name must be unique.
    const nameTaken = await prisma.university.findFirst({
      where: {
        name: { equals: body.name, mode: "insensitive" },
        countryId: body.countryId,
        deletedAt: null,
      },
    });
    if (nameTaken) {
      return fail("CONFLICT", "A university with this name already exists in this country", 409);
    }

    // Slug is derived from the name + a timestamp suffix to guarantee
    // uniqueness without requiring admin input. The slug is immutable
    // after creation.
    const slug = `${normalizeSlug(body.name)}-${Date.now().toString(36)}`;

    const uni = await prisma.university.create({
      data: {
        ...body,
        website: body.website || undefined,
        logo: body.logo || undefined,
        city: body.city || undefined,
        slug,
      },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "university.created",
      entity: "University",
      entityId: uni.id,
      newValue: {
        name: body.name,
        slug,
        countryId: body.countryId,
        ranking: body.ranking,
        status: body.status,
      },
    });
    return ok(uni, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
