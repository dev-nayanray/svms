import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { paymentRefundSchema } from "@/lib/validations";
import { invoiceService } from "@/lib/services/finance";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Refund a payment. Sets the payment's status to REFUNDED and adjusts
 * the linked invoice's paid/due/status accordingly. Refunded payments
 * cannot be edited. The refund reason is audit-logged.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = paymentRefundSchema.parse(await req.json());
    const refunded = await invoiceService.refund(id, body.reason, g.user);
    return ok(refunded);
  } catch (err) {
    return handleApiError(err);
  }
}
