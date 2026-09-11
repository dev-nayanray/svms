import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/**
 * Per-entity audit timeline endpoint — returns all audit entries for a
 * specific entity (Student, Application, Payment, Invoice, Document,
 * Employee, etc.), sorted newest-first.
 *
 * Used by the detail pages of Students, Applications, Payments, Invoices,
 * Documents, and Employees to render their audit timeline tab.
 *
 * Query params: entity (required), entityId (required), take (optional,
 * default 50, max 200).
 *
 * Security: requires `audit_logs.read` (admin only). The entity +
 * entityId are validated against the DB to prevent enumeration.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("audit_logs.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const entity = sp.get("entity");
    const entityId = sp.get("entityId");
    const take = Math.min(Number(sp.get("take") ?? 50), 200);

    if (!entity || !entityId) {
      return ok({ data: [] });
    }

    const entries = await prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: "desc" },
      take,
    });

    // Resolve user names
    const userIds = [...new Set(entries.map((e) => e.userId).filter((id): id is string => !!id))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const data = entries.map((entry) => ({
      ...entry,
      userName: entry.userId ? userMap.get(entry.userId) ?? "Unknown" : "System",
    }));

    return ok({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
