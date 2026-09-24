import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { createBackup, listBackupScopes } from "@/lib/system/backup";
import { rateLimit } from "@/lib/security/rate-limit";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

const createSchema = z.object({
  type: z.enum(["FULL", "SELECTIVE", "CONFIG"]),
  scope: z.array(z.string()).default(["*"]),
  trigger: z.enum(["manual", "scheduled", "pre-restore-safety"]).default("manual"),
  scheduleId: z.string().optional(),
});

/**
 * GET /api/admin/system/backups
 * Returns the backup history with server-side pagination + filters.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("backup.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const page = Math.max(Number(sp.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? 25), 100);

    const where: Record<string, unknown> = {};
    const type = sp.get("type");
    const status = sp.get("status");
    const search = sp.get("search")?.trim();
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) where.reference = { contains: search, mode: "insensitive" };

    const [data, total] = await Promise.all([
      prisma.backupRecord.findMany({
        where,
        orderBy: sortFrom(sp, ["reference", "createdAt"], { createdAt: "desc" }),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.backupRecord.count({ where }),
    ]);

    // Resolve creator names
    const userIds = [...new Set(data.map((d) => d.createdById).filter((id): id is string => !!id))];
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return ok({
      data: data.map((d) => ({
        ...d,
        startedAt: d.startedAt?.toISOString() ?? null,
        completedAt: d.completedAt?.toISOString() ?? null,
        verifiedAt: d.verifiedAt?.toISOString() ?? null,
        restoredAt: d.restoredAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        deletedAt: d.deletedAt?.toISOString() ?? null,
        createdBy: d.createdById ? userMap.get(d.createdById) ?? null : null,
        restoredBy: d.restoredById ? userMap.get(d.restoredById) ?? null : null,
      })),
      scopes: listBackupScopes(),
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

/**
 * POST /api/admin/system/backups
 * Create a new backup (manual). Runs synchronously — large DBs should
 * use the scheduled backup (cron endpoint) instead.
 *
 * Rate-limited to 5 backups per hour per admin to prevent accidental
 * storage exhaustion.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("backup.create");
    if (g.error) return g.error;

    // Rate-limit: 5 manual backups per hour
    const limited = rateLimit(req, { capacity: 5, refillRate: 5 / 3600 }, "backup.create");
    if (limited) return limited;

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid backup request", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }

    const result = await createBackup({
      type: parsed.data.type,
      scope: parsed.data.scope,
      trigger: parsed.data.trigger,
      scheduleId: parsed.data.scheduleId,
      createdById: g.user.id,
    });

    // Audit is recorded inside createBackup() — but we also log the IP/UA
    // from the request, which createBackup() can't see.
    const ctx = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: "backup.create.requested",
      entity: "BackupRecord",
      entityId: result.id,
      newValue: { reference: result.reference, type: parsed.data.type, scope: parsed.data.scope },
      ...ctx,
    });

    return ok(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
