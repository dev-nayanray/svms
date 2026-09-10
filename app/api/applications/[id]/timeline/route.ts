import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { applicationService } from "@/lib/services/application";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;
    const app = await prisma.application.findFirst({ where: { id, deletedAt: null } });
    if (!app) return ok({ data: [] });
    await applicationService.assertCanAccess(g.user, app);
    const history = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ data: history });
  } catch (err) {
    return handleApiError(err);
  }
}
