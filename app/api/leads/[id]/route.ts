import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { leadService } from "@/lib/services/lead";
import { leadUpdateSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("leads.read");
    if (g.error) return g.error;
    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: { employee: { include: { user: true, branch: true } } },
    });
    if (!lead) throw notFound("Lead");
    return ok(lead);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = leadUpdateSchema.parse(await req.json());

    const { archived, ...rest } = body;
    if (archived !== undefined) {
      const lead = await leadService.setArchived(id, archived, g.user);
      return ok(lead);
    }

    const lead = await leadService.update(id, { ...rest, email: body.email || undefined }, g.user);
    return ok(lead);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("leads.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) throw notFound("Lead");
    await prisma.lead.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: g.user.id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
