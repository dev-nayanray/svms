import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  try {
    const g = await guard("roles.read");
    if (g.error) return g.error;
    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    return ok({
      data: roles,
      permissionMatrix: PERMISSIONS,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
