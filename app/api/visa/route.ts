import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("visa.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const page = Math.max(Number(sp.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? 20), 100);
    const where = {
      ...(sp.get("stage") ? { stage: sp.get("stage")! } : {}),
      ...(sp.get("search")
        ? { application: { applicationNumber: { contains: sp.get("search")!, mode: "insensitive" as const } } }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.visaApplication.findMany({
        where,
        include: {
          application: { include: { student: true, country: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.visaApplication.count({ where }),
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

/** Update visa stage (VISA_PREPARATION → … → APPROVED/REFUSED). */
export async function PATCH(req: NextRequest) {
  try {
    const g = await guard("applications.manage");
    if (g.error) return g.error;
    const body = (await req.json()) as { id?: string; stage?: string };
    if (!body.id || !body.stage) {
      return ok({ updated: false });
    }
    const visa = await prisma.visaApplication.findUnique({ where: { id: body.id } });
    if (!visa) return ok({ updated: false });

    const updated = await prisma.visaApplication.update({
      where: { id: body.id },
      data: {
        stage: body.stage,
        submittedAt: body.stage === "VISA_SUBMITTED" && !visa.submittedAt ? new Date() : visa.submittedAt,
        decisionAt: ["APPROVED", "REFUSED"].includes(body.stage) ? new Date() : visa.decisionAt,
      },
    });
    // Keep the linked application stage in sync
    await prisma.application.update({
      where: { id: visa.applicationId },
      data: { stageKey: body.stage },
    });
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: visa.applicationId,
        fromStage: visa.stage,
        toStage: body.stage,
        changedById: g.user.id,
        note: "Visa stage updated",
      },
    });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
