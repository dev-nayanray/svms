import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const sp = req.nextUrl.searchParams;
    const unreadOnly = sp.get("unread") === "true";

    const data = await prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return ok({ data, unreadCount });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = (await req.json()) as { id?: string; all?: boolean };
    if (body.all) {
      await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return ok({ updated: true });
    }
    if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: user.id },
        data: { readAt: new Date() },
      });
    }
    return ok({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}
