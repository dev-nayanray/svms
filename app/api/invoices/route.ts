import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { invoiceSchema, paginationSchema } from "@/lib/validations";
import { invoiceService } from "@/lib/services/finance";
import { buildAdminInvoiceWhere, INVOICE_SORT_KEYS } from "@/lib/constants/finance";

/**
 * Admin invoices list endpoint.
 *
 * Returns invoices with full filters: search (invoice number), status,
 * studentId, applicationId, issueFrom/issueTo (date range on issueDate).
 * Sorting via the `sortFrom` allow-list. Pagination server-side.
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

    const issueFrom = sp.get("issueFrom") ? new Date(sp.get("issueFrom")!) : undefined;
    const issueTo = sp.get("issueTo") ? new Date(sp.get("issueTo")!) : undefined;

    const where = buildAdminInvoiceWhere({
      search: params.search,
      status: params.status,
      studentId: sp.get("studentId") ?? undefined,
      applicationId: sp.get("applicationId") ?? undefined,
      issueFrom,
      issueTo,
    });

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, studentId: true },
          },
          application: {
            select: { id: true, applicationNumber: true },
          },
          _count: { select: { payments: { where: { deletedAt: null } } } },
        },
        orderBy: sortFrom(sp, [...INVOICE_SORT_KEYS], { createdAt: "desc" }),
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
