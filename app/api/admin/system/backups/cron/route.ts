import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createBackup, applyRetention } from "@/lib/system/backup";
import { logSystemEvent } from "@/lib/system/logs";

/**
 * GET /api/admin/system/backups/cron?job=daily-backup&token=<CRON_SECRET>
 *
 * Vercel cron endpoint — invoked by Vercel's cron scheduler.
 * Secured by CRON_SECRET env var (Vercel automatically sends it as
 * the Authorization header, but we also accept ?token= for local dev).
 *
 * Jobs:
 *  - daily-backup:    FULL backup, DAILY retention (7)
 *  - weekly-backup:   FULL backup, WEEKLY retention (4)
 *  - monthly-backup:  FULL backup, MONTHLY retention (12)
 *
 * After each job: runs retention sweep + updates BackupSchedule.lastRun*.
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
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
      // In production, CRON_SECRET MUST be set.
      return fail("INTERNAL_ERROR", "CRON_SECRET not configured", 500);
    }

    const job = req.nextUrl.searchParams.get("job") ?? "daily-backup";

    // Map job name → frequency + retention
    const map: Record<string, { frequency: string; retention: number }> = {
      "daily-backup": { frequency: "DAILY", retention: 7 },
      "weekly-backup": { frequency: "WEEKLY", retention: 4 },
      "monthly-backup": { frequency: "MONTHLY", retention: 12 },
    };
    const cfg = map[job];
    if (!cfg) return fail("BAD_REQUEST", `Unknown job: ${job}`, 400);

    // Find the schedule (create if missing)
    let schedule = await prisma.backupSchedule.findFirst({
      where: { frequency: cfg.frequency },
    });
    if (!schedule) {
      schedule = await prisma.backupSchedule.create({
        data: {
          frequency: cfg.frequency,
          hour: 2,
          type: "FULL",
          scope: ["*"],
          retention: cfg.retention,
          enabled: true,
        },
      });
    }

    // Run the backup
    const startedAt = Date.now();
    let status: "COMPLETED" | "FAILED" = "COMPLETED";
    let lastError: string | null = null;
    try {
      await createBackup({
        type: "FULL",
        scope: ["*"],
        trigger: "scheduled",
        scheduleId: schedule.id,
        createdById: "cron",
      });
    } catch (err) {
      status = "FAILED";
      lastError = err instanceof Error ? err.message : String(err);
      await logSystemEvent("ERROR", "cron", `${job} failed: ${lastError}`, { scheduleId: schedule.id });
    }

    // Update the schedule
    await prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastError,
      },
    });

    // Run retention sweep (best-effort)
    let purged = 0;
    try {
      const result = await applyRetention("cron");
      purged = result.deleted;
    } catch {
      // ignore
    }

    return ok({
      job,
      status,
      durationMs: Date.now() - startedAt,
      purged,
      lastError,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
