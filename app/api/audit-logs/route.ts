import { NextRequest } from "next/server";
import { ok, handleApiError, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { buildAuditWhere, AUDIT_ENTITY_TYPES, AUDIT_ENTITY_LABELS } from "@/lib/constants/audit";

/**
 * Admin Audit Log endpoint — returns audit entries with full server-side
 * filtering, search, and pagination.
 *
 * Filters: userId, action, entity, entityId, dateFrom, dateTo.
 * Search: across action + entity (case-insensitive contains).
 * Sorting: via `sortFrom` allow-list (action, entity, createdAt).
 *
 * Security:
 *  - Requires `audit_logs.read` (admin only).
 *  - Audit records are immutable — there is no PATCH or DELETE endpoint.
 *  - The `userId` in the response is a plain ObjectId (no joins by
 *    default for performance); the UI can resolve names client-side.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("audit_logs.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const page = Math.max(Number(sp.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? 25), 100);

    const dateFrom = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : undefined;
    const dateTo = sp.get("dateTo") ? new Date(sp.get("dateTo")!) : undefined;

    const where = buildAuditWhere({
      search: sp.get("search") ?? undefined,
      userId: sp.get("userId") ?? undefined,
      action: sp.get("action") ?? undefined,
      entity: sp.get("entity") ?? undefined,
      entityId: sp.get("entityId") ?? undefined,
      dateFrom,
      dateTo,
    });

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: sortFrom(sp, ["action", "entity", "createdAt"], { createdAt: "desc" }),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Resolve user names for the userId references
    const userIds = [...new Set(data.map((d) => d.userId).filter((id): id is string => !!id))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const dataWithUsers = data.map((entry) => ({
      ...entry,
      user: entry.userId ? userMap.get(entry.userId) ?? null : null,
    }));

    return ok({
      data: dataWithUsers,
      entityTypes: AUDIT_ENTITY_TYPES.map((t) => ({
        value: t,
        label: AUDIT_ENTITY_LABELS[t] ?? t,
      })),
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
