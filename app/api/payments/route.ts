import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { invoiceService } from "@/lib/services/finance";
import { paymentSchema, invoiceSchema, paginationSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";

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
    const isInvoice = sp.get("type") === "invoice";
    const where = { deletedAt: null, ...(params.status ? { status: params.status } : {}) };
    if (isInvoice) {
      const [data, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: { student: true },
          orderBy: sortFrom(sp, ["amount", "paymentDate", "status", "createdAt"]),
          skip: (params.page - 1) * params.pageSize,
          take: params.pageSize,
        }),
        prisma.invoice.count({ where }),
      ]);
      return ok({ data, total, type: "invoice" });
    }
    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { student: true, invoice: true },
        orderBy: sortFrom(sp, ["amount", "paymentDate", "status", "createdAt"]),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.payment.count({ where }),
    ]);
    return ok({ data, total, type: "payment" });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST creates a payment (?type=invoice creates an invoice). */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("finance.manage");
    if (g.error) return g.error;
    if (req.nextUrl.searchParams.get("type") === "invoice") {
      const body = invoiceSchema.parse(await req.json());
      const invoice = await invoiceService.create(body, g.user);
      return ok(invoice, { status: 201 });
    }
    const body = paymentSchema.parse(await req.json());
    const payment = await invoiceService.recordPayment(body, g.user);
    return ok(payment, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
