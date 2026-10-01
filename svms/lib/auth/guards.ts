import { auth } from "@/lib/auth";
import { fail, HttpError } from "@/lib/api";
import { assertPermission, type PermissionKey } from "@/lib/permissions";
import type { Session } from "next-auth";

export type AuthUser = Session["user"] & { role: string };

/** Returns the session or throws — for use inside API routes wrapped by handleApiError. */
export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  }
  return session.user as AuthUser;
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
  const user = session.user as AuthUser;
  if (permission) {
    try {
      assertPermission(user.role, permission);
    } catch {
      return { user: null, error: fail("FORBIDDEN", "You do not have access", 403) };
    }
  }
  return { user, error: null };
}

/**
 * Resolve the caller's Employee record from the authenticated session.
 * Returns null when the caller is not an Employee (so the route handler
 * can return 403). The employeeId NEVER comes from the client.
 */
export async function requireEmployee(): Promise<
  | { ok: true; user: AuthUser; employeeId: string }
  | { ok: false; error: ReturnType<typeof fail> }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: fail("UNAUTHORIZED", "Authentication required", 401) };
  }
  const user = session.user as AuthUser;
  if (user.role !== "EMPLOYEE" && user.role !== "ADMIN") {
    return { ok: false, error: fail("FORBIDDEN", "Employees only", 403) };
  }
  // For EMPLOYEE role we need to resolve the Employee row to enforce
  // case ownership (assigned students, leads, etc.).
  if (user.role === "EMPLOYEE") {
    const { prisma } = await import("@/lib/db");
    const employee = await prisma.employee.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!employee) {
      return { ok: false, error: fail("FORBIDDEN", "No employee record linked to this account", 403) };
    }
    return { ok: true, user, employeeId: employee.id };
  }
  // ADMIN has no employee record but may access employee routes with full scope.
  return { ok: true, user, employeeId: "" };
}
