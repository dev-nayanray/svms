import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("audit_logs.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const page = Math.max(Number(sp.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? 20), 100);
    const search = sp.get("search") ?? undefined;
    const where = search
      ? {
          OR: [
            { action: { contains: search, mode: "insensitive" as const } },
            { entity: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: sortFrom(sp, ["action", "entity", "createdAt"]),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return ok({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
