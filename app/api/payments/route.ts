import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { paymentSchema, paginationSchema } from "@/lib/validations";
import { invoiceService } from "@/lib/services/finance";
import { buildAdminPaymentWhere, PAYMENT_SORT_KEYS } from "@/lib/constants/finance";

/**
 * Admin payments list endpoint.
 *
 * Returns payments with full filters: search (transaction reference),
 * status, studentId, applicationId, invoiceId, paymentMethod,
 * paymentFrom/paymentTo (date range on paymentDate). Sorting via the
 * `sortFrom` allow-list. Pagination server-side. Soft-deleted records
 * are excluded by default.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("finance.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const params = paginationSchema.parse({
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    const paymentFrom = sp.get("paymentFrom") ? new Date(sp.get("paymentFrom")!) : undefined;
    const paymentTo = sp.get("paymentTo") ? new Date(sp.get("paymentTo")!) : undefined;

    const where = buildAdminPaymentWhere({
      search: params.search,
      status: params.status,
      studentId: sp.get("studentId") ?? undefined,
      applicationId: sp.get("applicationId") ?? undefined,
      invoiceId: sp.get("invoiceId") ?? undefined,
      paymentMethod: sp.get("paymentMethod") ?? undefined,
      paymentFrom,
      paymentTo,
    });

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, studentId: true },
          },
          application: {
            select: { id: true, applicationNumber: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
        },
        orderBy: sortFrom(sp, [...PAYMENT_SORT_KEYS], { paymentDate: "desc" }),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.payment.count({ where }),
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
    const body = paymentSchema.parse(await req.json());
    const payment = await invoiceService.recordPayment(body, g.user);
    return ok(payment, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
