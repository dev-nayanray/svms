import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { intakeSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("courses.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const page = Math.max(Number(sp.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? 20), 100);
    const where = {
      ...(sp.get("courseId") ? { courseId: sp.get("courseId")! } : {}),
      ...(sp.get("status") ? { status: sp.get("status")! } : {}),
      ...(sp.get("search")
        ? { name: { contains: sp.get("search")!, mode: "insensitive" as const } }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.intake.findMany({
        where,
        include: { course: { include: { university: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.intake.count({ where }),
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

export async function POST(req: NextRequest) {
  try {
    const g = await guard("intakes.manage");
    if (g.error) return g.error;
    const body = intakeSchema.parse(await req.json());
    const intake = await prisma.intake.create({ data: body });
    await auditLog.record({
      userId: g.user.id,
      action: "intake.created",
      entity: "Intake",
      entityId: intake.id,
      newValue: { name: body.name, courseId: body.courseId },
    });
    return ok(intake, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
