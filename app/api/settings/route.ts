import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";

export async function GET() {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;
    const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
    return ok({ data: settings });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Upsert a setting; every change is audit-logged. */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;
    const body = (await req.json()) as { key?: string; value?: unknown };
    if (!body.key) {
      return ok({ updated: false });
    }
    const existing = await prisma.systemSetting.findUnique({ where: { key: body.key } });
    const setting = await prisma.systemSetting.upsert({
      where: { key: body.key },
      update: { value: body.value as object },
      create: { key: body.key, value: body.value as object },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "setting.updated",
      entity: "SystemSetting",
      entityId: setting.id,
      oldValue: existing ? { value: existing.value } : undefined,
      newValue: { key: body.key, value: body.value },
    });
    return ok(setting);
  } catch (err) {
    return handleApiError(err);
  }
}
