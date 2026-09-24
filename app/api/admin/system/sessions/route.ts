import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/system/sessions
 *
 * Lists "active sessions" — approximated as users who logged in
 * recently. NextAuth v5 with JWT strategy doesn't store sessions
 * server-side, so we can't revoke individual JWTs directly.
 *
 * For full session revocation, the admin should use the User
 * Management page to suspend the user (which causes the periodic
 * JWT revalidation to invalidate the token within 5 minutes).
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("system.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const window = sp.get("window") ?? "1h"; // 5m | 1h | 24h
    const windowMs = window === "5m" ? 5 * 60 * 1000 : window === "24h" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const since = new Date(Date.now() - windowMs);

    const users = await prisma.user.findMany({
      where: { lastLoginAt: { gte: since }, status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        roleName: true,
        lastLoginAt: true,
      },
      orderBy: { lastLoginAt: "desc" },
      take: 100,
    });

    return ok({
      window,
      sessions: users.map((u) => ({
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        role: u.roleName,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        note: "JWT strategy — to revoke, suspend the user from User Management",
      })),
      count: users.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
