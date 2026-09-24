import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { verifyBackup } from "@/lib/system/verify";
import { auditLog } from "@/lib/services/audit";

/**
 * POST /api/admin/system/backups/[id]/verify
 * Runs verification checks against the backup archive.
 * Updates status to VERIFIED or FAILED.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("backup.create");
    if (g.error) return g.error;

    const { id } = await ctx.params;
    const result = await verifyBackup(id, g.user.id);

    const auditCtx = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: "backup.verify.requested",
      entity: "BackupRecord",
      entityId: id,
      newValue: result,
      ...auditCtx,
    });

    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}

void notFound;
