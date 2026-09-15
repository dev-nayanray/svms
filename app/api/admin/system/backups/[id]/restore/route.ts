import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { restoreBackup } from "@/lib/system/restore";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

const CONFIRMATION_PHRASE = "I UNDERSTAND THE RISK";

const restoreSchema = z.object({
  confirmation: z.literal(CONFIRMATION_PHRASE),
  onlyModels: z.array(z.string()).optional(),
  skipExisting: z.boolean().default(true),
  acknowledgeUnverified: z.boolean().default(false),
});

/**
 * POST /api/admin/system/backups/[id]/restore
 *
 * HIGH-RISK OPERATION. Requires:
 *  1. backup.restore permission (admin only)
 *  2. Confirmation phrase: "I UNDERSTAND THE RISK"
 *  3. If backup is not verified, requires acknowledgeUnverified=true
 *
 * Before restore, the service creates a safety backup (best-effort).
 * Every restore is audited with full IP/UA capture.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("backup.restore");
    if (g.error) return g.error;

    const { id } = await ctx.params;

    // Confirm backup exists
    const backup = await prisma.backupRecord.findUnique({ where: { id } });
    if (!backup) return fail("NOT_FOUND", "Backup not found", 404);

    // Verify backup is verified OR admin acknowledged the risk
    if (backup.verificationStatus !== "PASSED") {
      const body = await req.json();
      const parsedPartial = restoreSchema.partial().safeParse(body);
      if (!parsedPartial.data?.acknowledgeUnverified) {
        return fail(
          "BAD_REQUEST",
          "Backup has not been verified. Verify it first or pass acknowledgeUnverified=true",
          400,
        );
      }
    }

    const body = await req.json();
    const parsed = restoreSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid restore request", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }

    const result = await restoreBackup(id, g.user.id, {
      onlyModels: parsed.data.onlyModels,
      skipExisting: parsed.data.skipExisting,
    });

    const auditCtx = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: "backup.restore.requested",
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
