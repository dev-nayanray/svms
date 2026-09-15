import { NextRequest } from "next/server";
import { handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { readBackupArchive } from "@/lib/system/backup";
import { auditLog } from "@/lib/services/audit";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/system/backups/[id]/download
 *
 * Streams the (decrypted) backup archive to the admin's browser.
 * Authenticated + authorized only — never produces a public URL.
 *
 * The download is audited with IP + UA + size.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("backup.read");
    if (g.error) return g.error;

    const { id } = await ctx.params;
    const record = await prisma.backupRecord.findUnique({ where: { id } });
    if (!record) return fail("NOT_FOUND", "Backup not found", 404);
    if (record.deletedAt) return fail("NOT_FOUND", "Backup has been deleted", 404);

    const { bytes } = await readBackupArchive(id);

    const auditCtx = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: "backup.downloaded",
      entity: "BackupRecord",
      entityId: id,
      newValue: { reference: record.reference, sizeBytes: bytes.byteLength },
      ...auditCtx,
    });

    const filename = `${record.reference}.jsonl`;
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/x-jsonlines",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        // No caching — this is sensitive data.
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
