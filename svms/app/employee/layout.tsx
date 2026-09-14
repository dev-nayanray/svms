import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EMPLOYEE_NAV_GROUPS, type NavGroup } from "@/config/employee-nav";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { EmployeeAppShell } from "@/components/employee/app-shell";
import { getUnreadCount, getRecentNotifications } from "@/lib/services/notification-cases";
import { getSettings, DEFAULT_THEME, type Theme } from "@/lib/services/settings-cases";

export const dynamic = "force-dynamic";

/**
 * Employee Panel server-side guard.
 *
 * Only the EMPLOYEE and ADMIN roles may enter /employee. ADMIN has full
 * scope; EMPLOYEE is scoped to their own Employee record (case ownership).
 *
 * Authorization happens here, server-side, before any page renders.
 * The client-side shell receives only the filtered navigation config —
 * permission keys never leak to the browser.
 *
 * The shell also receives the initial notification badge count, the 5
 * most recent notifications, and the user's theme preference — all
 * loaded server-side to avoid a flash of wrong state on every page
 * navigation.
 */
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee");

  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  // Resolve Employee record for case ownership. ADMIN skips this — they
  // see all records regardless of assignment.
  let employeeId: string | null = null;
  let employeeTitle: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true, title: true },
    });
    if (!employee) redirect("/403");
    employeeId = employee.id;
    employeeTitle = employee.title;
  }

  // Filter the sidebar nav by the caller's permissions.
  const visibleGroups: NavGroup[] = EMPLOYEE_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.permission || hasPermission(role, item.permission as PermissionKey)),
  })).filter((g) => g.items.length > 0);

  // Load initial notification state for the header bell + the user's
  // theme preference (server-side, so no flash).
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const [unreadCountRaw, recentNotificationsRaw, settings] = await Promise.all([
    getUnreadCount(scope),
    getRecentNotifications(scope, 5),
    getSettings(session.user.id).catch(() => null),
  ]);
  // Defensive: if any call throws, fall back to empty state so the
  // shell still renders.
  const unreadCount = unreadCountRaw && typeof unreadCountRaw.total === "number"
    ? unreadCountRaw
    : { total: 0, byCategory: {} as never };
  const recentNotifications = Array.isArray(recentNotificationsRaw) ? recentNotificationsRaw : [];
  const theme: Theme = settings?.theme ?? DEFAULT_THEME;

  return (
    <EmployeeAppShell
      userName={session.user.name ?? "Employee"}
      userEmail={session.user.email ?? ""}
      userRole={role ?? "EMPLOYEE"}
      employeeId={employeeId}
      employeeTitle={employeeTitle}
      navGroups={visibleGroups}
      initialUnreadCount={unreadCount.total}
      initialRecentNotifications={recentNotifications}
      initialTheme={theme}
    >
      {children}
    </EmployeeAppShell>
  );
}
