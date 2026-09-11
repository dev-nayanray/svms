import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import {
  buildNotificationWhere,
  type NotificationReadFilter,
} from "@/lib/constants/notifications";
import { auditLog } from "@/lib/services/audit";

/**
 * Notification center endpoint — returns notifications with read-status
 * filtering (all/unread/read) + search + pagination.
 *
 * All roles can access their own notifications. The endpoint auto-scopes
 * to the authenticated user's ID.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const sp = req.nextUrl.searchParams;
    const readFilter = (sp.get("filter") ?? "all") as NotificationReadFilter;
    const search = sp.get("search") ?? undefined;
    const page = Math.max(Number(sp.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(sp.get("pageSize") ?? 50), 100);

    const where = buildNotificationWhere({ userId: user.id, readFilter, search });

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);

    return ok({
      data,
      unreadCount,
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
 * Mark notifications as read. Body: { id?: string, all?: boolean }.
 * - `all: true` marks all unread notifications as read.
 * - `id: "..."` marks a single notification as read.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = (await req.json()) as { id?: string; all?: boolean };

    if (body.all) {
      const result = await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      await auditLog.record({
        userId: user.id,
        action: "notification.marked_all_read",
        entity: "Notification",
        newValue: { count: result.count },
      });
      return ok({ updated: true, count: result.count });
    }

    if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: user.id },
        data: { readAt: new Date() },
      });
      return ok({ updated: true });
    }

    return fail("BAD_REQUEST", "Provide either 'id' or 'all'", 400);
  } catch (err) {
    return handleApiError(err);
  }
}
