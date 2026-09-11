import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { countrySchema, paginationSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { normalizeCountryCode } from "@/lib/constants/countries";

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
    const currency = sp.get("currency") ?? undefined;

    const where = {
      deletedAt: archived ? { not: null } : null,
      ...(params.status ? { status: params.status } : {}),
      ...(currency ? { currency: { equals: currency } } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { code: { contains: params.search, mode: "insensitive" as const } },
              { currency: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.country.findMany({
        where,
        include: {
          _count: {
            select: {
              universities: { where: { deletedAt: null } },
              applications: { where: { deletedAt: null, status: "ACTIVE" } },
              visaRequirements: { where: { status: "ACTIVE" } },
            },
          },
        },
        orderBy: sortFrom(sp, ["name", "code", "currency", "status", "createdAt"], {
          name: "asc",
        }),
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
    // Normalize the code to uppercase so lookups and uniqueness checks are stable.
    const code = normalizeCountryCode(body.code);
    const name = body.name.trim();

    const dupName = await prisma.country.findFirst({
      where: { name, deletedAt: null },
    });
    if (dupName) return fail("CONFLICT", "A country with this name already exists", 409);
    const dupCode = await prisma.country.findFirst({
      where: { code, deletedAt: null },
    });
    if (dupCode) return fail("CONFLICT", "Another country uses this code", 409);

    const country = await prisma.country.create({
      data: { ...body, name, code },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "country.created",
      entity: "Country",
      entityId: country.id,
      newValue: { name, code, currency: body.currency, status: body.status },
    });
    return ok(country, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
