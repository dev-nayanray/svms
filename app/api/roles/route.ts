import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { PERMISSION_GROUPS, ROLE_METADATA } from "@/lib/constants/permissions-meta";

/**
 * Returns roles with user counts + the full permission matrix + the
 * permission group metadata for the admin UI.
 *
 * The matrix is the single source of truth from `lib/permissions/index.ts`.
 * The group metadata provides human-readable labels + descriptions so
 * the admin can understand what each permission does.
 *
 * Security: the matrix is read-only by design. Runtime modification of
 * permissions is intentionally not exposed — changing which roles have
 * which permissions requires a code change + code review + redeploy.
 * This prevents privilege escalation via the database.
 */
export async function GET() {
  try {
    const g = await guard("roles.read");
    if (g.error) return g.error;

    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });

    const roleNames = roles.map((r) => r.name);

    // Build the matrix: { permissionKey: { roleName: boolean } }
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const [key, allowedRoles] of Object.entries(PERMISSIONS)) {
      matrix[key] = {};
      for (const role of roleNames) {
        matrix[key][role] = (allowedRoles as readonly string[]).includes(role);
      }
    }

    return ok({
      data: roles.map((r) => ({
        ...r,
        label: ROLE_METADATA[r.name]?.label ?? r.name,
        description: r.description ?? ROLE_METADATA[r.name]?.description ?? "",
        userCount: r._count.users,
      })),
      matrix,
      roleNames,
      groups: PERMISSION_GROUPS,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
