import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { countrySchema, paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("countries.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });
    const archived = sp.get("archived") === "true";
    const where = {
      deletedAt: archived ? { not: null } : null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { code: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.country.findMany({
        where,
        include: { _count: { select: { universities: true, applications: true } } },
        orderBy: sortFrom(sp, ["name", "code", "status", "createdAt"], { name: "asc" }),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.country.count({ where }),
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
    const g = await guard("countries.manage");
    if (g.error) return g.error;
    const body = countrySchema.parse(await req.json());
    const dupName = await prisma.country.findFirst({ where: { name: body.name, deletedAt: null } });
    if (dupName) return fail("CONFLICT", "A country with this name already exists", 409);
    const dupCode = await prisma.country.findFirst({ where: { code: body.code, deletedAt: null } });
    if (dupCode) return fail("CONFLICT", "Another country uses this code", 409);
    const country = await prisma.country.create({ data: body });
    await auditLog.record({
      userId: g.user.id,
      action: "country.created",
      entity: "Country",
      entityId: country.id,
      newValue: { name: body.name, code: body.code },
    });
    return ok(country, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
