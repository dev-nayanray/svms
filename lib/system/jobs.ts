import { prisma } from "@/lib/db";

/**
 * Cron / Background Jobs Monitor
 * ===============================
 *
 * Vercel cron jobs are declared in vercel.json (NOT in code). This
 * service lists the jobs the application expects + tracks their
 * last-run status from SystemHealthCheck rows (where component="cron").
 *
 * For non-Vercel deployments, jobs can be triggered manually from
 * the admin UI or via an external scheduler hitting the API route.
 */

export type KnownJob = {
  name: string;
  description: string;
  schedule: string;
  endpoint: string;
};

/** The canonical list of cron jobs the application expects to exist. */
export const KNOWN_JOBS: KnownJob[] = [
  {
    name: "daily-backup",
    description: "Creates a FULL backup of all application data (retention: 7 daily).",
    schedule: "0 2 * * *", // 02:00 UTC daily
    endpoint: "/api/admin/system/backups/cron?job=daily-backup",
  },
  {
    name: "weekly-backup",
    description: "Creates a FULL backup (retention: 4 weekly).",
    schedule: "0 3 * * 1", // 03:00 UTC every Monday
    endpoint: "/api/admin/system/backups/cron?job=weekly-backup",
  },
  {
    name: "monthly-backup",
    description: "Creates a FULL backup (retention: 12 monthly).",
    schedule: "0 4 1 * *", // 04:00 UTC on the 1st of each month
    endpoint: "/api/admin/system/backups/cron?job=monthly-backup",
  },
  {
    name: "cleanup-deleted-backups",
    description: "Purges backup archives marked deleted >24h ago.",
    schedule: "0 5 * * *", // 05:00 UTC daily
    endpoint: "/api/admin/system/jobs/cron?job=cleanup-deleted-backups",
  },
  {
    name: "health-check",
    description: "Runs the system health check suite + persists results.",
    schedule: "*/15 * * * *", // every 15 min
    endpoint: "/api/admin/system/health/cron?job=health-check",
  },
];

export type JobRunStatus = {
  name: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
};

export async function getJobsStatus(): Promise<
  Array<KnownJob & { lastRun: JobRunStatus }>
> {
  // Pull the most recent SystemHealthCheck row for each job
  const jobNames = KNOWN_JOBS.map((j) => j.name);
  const recent: JobRunStatus[] = [];
  for (const name of jobNames) {
    try {
      // Backup jobs store their status on BackupSchedule.lastRunStatus
      if (name.includes("backup")) {
        const freq = name.startsWith("daily")
          ? "DAILY"
          : name.startsWith("weekly")
            ? "WEEKLY"
            : name.startsWith("monthly")
              ? "MONTHLY"
              : null;
        if (freq) {
          const sched = await prisma.backupSchedule.findFirst({
            where: { frequency: freq },
          });
          if (sched) {
            recent.push({
              name,
              lastRunAt: sched.lastRunAt?.toISOString() ?? null,
              lastStatus: sched.lastRunStatus ?? null,
              lastError: sched.lastError ?? null,
            });
            continue;
          }
        }
      }
      // Other jobs: check SystemHealthCheck where component="cron.{name}"
      const last = await prisma.systemHealthCheck.findFirst({
        where: { component: `cron.${name}` },
        orderBy: { checkedAt: "desc" },
      });
      recent.push({
        name,
        lastRunAt: last?.checkedAt.toISOString() ?? null,
        lastStatus: last?.status ?? null,
        lastError: last?.message ?? null,
      });
    } catch {
      recent.push({ name, lastRunAt: null, lastStatus: null, lastError: null });
    }
  }

  return KNOWN_JOBS.map((j) => ({
    ...j,
    lastRun: recent.find((r) => r.name === j.name) ?? {
      name: j.name,
      lastRunAt: null,
      lastStatus: null,
      lastError: null,
    },
  }));
}

/** Record a job run (called by cron API routes). Best-effort. */
export async function recordJobRun(
  name: string,
  status: "healthy" | "warning" | "critical",
  message: string,
  latencyMs?: number,
): Promise<void> {
  try {
    await prisma.systemHealthCheck.create({
      data: {
        component: `cron.${name}`,
        status,
        message,
        latencyMs: latencyMs ?? null,
      },
    });
  } catch {
    // best-effort
  }
}
