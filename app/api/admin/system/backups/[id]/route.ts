import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { deleteBackup } from "@/lib/system/backup";
import { auditLog } from "@/lib/services/audit";

/**
 * GET /api/admin/system/backups/[id]
 * Returns full details for a single backup record.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("backup.read");
    if (g.error) return g.error;

    const { id } = await ctx.params;
    const record = await prisma.backupRecord.findUnique({ where: { id } });
    if (!record) throw notFound("Backup");

    return ok({
      ...record,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      verifiedAt: record.verifiedAt?.toISOString() ?? null,
      restoredAt: record.restoredAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/system/backups/[id]
 * Soft-delete a backup. Refuses to delete the only known valid backup.
 * Audited.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("backup.delete");
    if (g.error) return g.error;

    const { id } = await ctx.params;
    const auditCtx = auditLog.fromRequest(req);
    await deleteBackup(id, g.user.id);

    await auditLog.record({
      userId: g.user.id,
      action: "backup.delete.requested",
      entity: "BackupRecord",
      entityId: id,
      ...auditCtx,
    });

    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
