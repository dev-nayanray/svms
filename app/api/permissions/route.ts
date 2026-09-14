import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";
import {
  PERMISSION_GROUPS,
  PERMISSION_DESCRIPTIONS,
  getAllPermissionKeys,
} from "@/lib/constants/permissions-meta";

/**
 * Returns the full permission catalog: all permission keys, grouped by
 * category, with human-readable labels and descriptions.
 *
 * Used by the admin UI to render the permission matrix with group
 * headers and tooltip descriptions.
 */
export async function GET() {
  try {
    const g = await guard("roles.read");
    if (g.error) return g.error;

    const allKeys = getAllPermissionKeys();
    const roleNames = ["ADMIN", "EMPLOYEE", "STUDENT"];

    return ok({
      data: allKeys,
      groups: PERMISSION_GROUPS.map((group) => ({
        ...group,
        permissions: group.permissions.map((key) => ({
          key,
          description: PERMISSION_DESCRIPTIONS[key] ?? "",
          roles: Object.fromEntries(
            roleNames.map((role) => [
              role,
              (PERMISSIONS[key as keyof typeof PERMISSIONS] as readonly string[] | undefined)?.includes(role) ?? false,
            ]),
          ),
        })),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
