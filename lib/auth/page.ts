import { HttpError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guards";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

/**
 * Page/service-level access helper for server components.
 * Redirects unauthenticated users via thrown HttpError; callers
 * in RSC should use `getSessionOrRedirect` from session.ts instead.
 */
export async function requirePage(permission?: PermissionKey) {
  const user = await requireAuth();
  if (permission && !hasPermission(user.role, permission)) {
    throw new HttpError(403, "FORBIDDEN", "You do not have access to this page");
  }
  return user;
}
