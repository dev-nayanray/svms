import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { courseSchema, paginationSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils/slug";

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
    const maxFee = sp.get("maxFee") ? Number(sp.get("maxFee")) : undefined;
    const where = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(sp.get("universityId") ? { universityId: sp.get("universityId")! } : {}),
      ...(sp.get("degreeLevel") ? { degreeLevel: sp.get("degreeLevel")! } : {}),
      ...(maxFee ? { tuitionFee: { lte: maxFee } } : {}),
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" as const } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: { university: { include: { country: true } } },
        orderBy: sortFrom(sp, ["name", "tuitionFee", "degreeLevel", "createdAt"], { name: "asc" }),
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
    const slug = `${slugify(body.name)}-${Date.now().toString(36)}`;
    const course = await prisma.course.create({ data: { ...body, slug } });
    return ok(course, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
