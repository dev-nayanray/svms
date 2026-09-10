import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { invoiceSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.read");
    if (g.error) return g.error;
    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: { student: true, application: true, payments: true },
    });
    if (!invoice) throw notFound("Invoice");
    return ok(invoice);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = invoiceSchema.partial().parse(await req.json());
    const invoice = await prisma.invoice.findFirst({ where: { id, deletedAt: null } });
    if (!invoice) throw notFound("Invoice");
    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "ISSUED", dueDate: body.dueDate ?? invoice.dueDate },
    });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
