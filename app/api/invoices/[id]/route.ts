import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { invoiceUpdateSchema } from "@/lib/validations";
import { invoiceService } from "@/lib/services/finance";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Get a single invoice with student + application + payments joins.
 * The items JSON is typed as InvoiceItem[] on the client.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.read");
    if (g.error) return g.error;
    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        student: true,
        application: true,
        payments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!invoice) throw notFound("Invoice");
    return ok(invoice);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Update an invoice's editable fields (items, discount, issue/due dates,
 * status). Totals are recomputed server-side when items or discount
 * change. Delegates to `invoiceService.update`.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = invoiceUpdateSchema.parse(await req.json());
    const updated = await invoiceService.update(id, body, g.user);
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive (soft-delete) an invoice. Financial records are never
 * hard-deleted — this retains the record for audit trails.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const archived = await invoiceService.archive(id, g.user);
    return ok({ archived: true, deletedAt: archived.deletedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
