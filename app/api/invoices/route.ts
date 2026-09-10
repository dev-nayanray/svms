import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { invoiceSchema, paginationSchema } from "@/lib/validations";
import { invoiceService } from "@/lib/services/finance";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("finance.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      status: sp.get("status") ?? undefined,
    });
    const where = { deletedAt: null, ...(params.status ? { status: params.status } : {}) };
    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { student: true },
        orderBy: sortFrom(sp, ["invoiceNumber", "total", "paidAmount", "dueAmount", "status", "createdAt"]),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.invoice.count({ where }),
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
    const g = await guard("finance.manage");
    if (g.error) return g.error;
    const body = invoiceSchema.parse(await req.json());
    const invoice = await invoiceService.create(body, g.user);
    return ok(invoice, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
