import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { universitySchema, paginationSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils/slug";
import { auditLog } from "@/lib/services/audit";

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
    const where = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(sp.get("countryId") ? { countryId: sp.get("countryId")! } : {}),
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" as const } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.university.findMany({
        where,
        include: { country: true, _count: { select: { courses: true } } },
        orderBy: sortFrom(sp, ["name", "ranking", "createdAt"], { name: "asc" }),
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
    const slug = `${slugify(body.name)}-${Date.now().toString(36)}`;
    const uni = await prisma.university.create({
      data: { ...body, website: body.website || undefined, slug },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "university.created",
      entity: "University",
      entityId: uni.id,
      newValue: { name: body.name },
    });
    return ok(uni, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
