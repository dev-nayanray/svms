import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EMPLOYEE_NAV_GROUPS, type NavGroup } from "@/config/employee-nav";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { EmployeeAppShell } from "@/components/employee/app-shell";

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

  return (
    <EmployeeAppShell
      userName={session.user.name ?? "Employee"}
      userEmail={session.user.email ?? ""}
      userRole={role ?? "EMPLOYEE"}
      employeeId={employeeId}
      employeeTitle={employeeTitle}
      navGroups={visibleGroups}
    >
      {children}
    </EmployeeAppShell>
  );
}
