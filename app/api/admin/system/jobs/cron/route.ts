import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/services/file-storage";
import { recordJobRun } from "@/lib/system/jobs";
import { logSystemEvent } from "@/lib/system/logs";

/**
 * GET /api/admin/system/jobs/cron?job=cleanup-deleted-backups&token=<CRON_SECRET>
 *
 * Daily cleanup job — purges backup archives that were soft-deleted
 * more than 24h ago. Runs via Vercel cron (see vercel.json).
 */
export async function GET(req: NextRequest) {
  try {
    const expectedToken = process.env.CRON_SECRET;
    if (expectedToken) {
      const authHeader = req.headers.get("authorization") ?? "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const queryToken = req.nextUrl.searchParams.get("token");
      const got = bearer ?? queryToken;
      if (got !== expectedToken) {
        return fail("UNAUTHORIZED", "Invalid cron token", 401);
      }
    } else if (process.env.NODE_ENV === "production") {
      return fail("INTERNAL_ERROR", "CRON_SECRET not configured", 500);
    }

    const job = req.nextUrl.searchParams.get("job") ?? "cleanup-deleted-backups";
    if (job !== "cleanup-deleted-backups") {
      return fail("BAD_REQUEST", `Unknown job: ${job}`, 400);
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await prisma.backupRecord.findMany({
      where: { deletedAt: { lt: cutoff }, storageKey: { not: null } },
      select: { id: true, storageKey: true, reference: true },
    });

    let purged = 0;
    for (const b of stale) {
      if (b.storageKey) {
        await fileStorage.remove(b.storageKey);
      }
      await prisma.backupRecord.delete({ where: { id: b.id } });
      purged++;
    }

    await recordJobRun("cleanup-deleted-backups", "healthy", `Purged ${purged} stale backup(s)`);
    await logSystemEvent("INFO", "cron", `Cleanup: purged ${purged} stale backup(s)`, { purged });

    return ok({ purged, scanned: stale.length });
  } catch (err) {
    return handleApiError(err);
  }
}
