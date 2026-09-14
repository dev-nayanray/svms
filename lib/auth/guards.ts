import { auth } from "@/lib/auth";
import { assertPermission, type PermissionKey } from "@/lib/permissions";
import { fail, HttpError } from "@/lib/api";
import type { Session } from "next-auth";

export type AuthUser = Session["user"];

/** Returns the session or throws — for use inside API routes wrapped by handleApiError. */
export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  }
  return session.user;
}

export async function requirePermission(permission: PermissionKey): Promise<AuthUser> {
  const user = await requireAuth();
  assertPermission(user.role, permission);
  return user;
}

/** 401/403 responses for route handlers that return directly. */
export async function guard(permission?: PermissionKey): Promise<
  { user: AuthUser; error: null } | { user: null; error: ReturnType<typeof fail> }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { user: null, error: fail("UNAUTHORIZED", "Authentication required", 401) };
  }
  if (permission && session.user.role) {
    const { hasPermission } = await import("@/lib/permissions");
    if (!hasPermission(session.user.role, permission)) {
      return { user: null, error: fail("FORBIDDEN", "You do not have access", 403) };
    }
  }
  return { user: session.user, error: null };
}
