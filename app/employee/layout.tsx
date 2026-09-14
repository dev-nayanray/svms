import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/shared/admin-shell";
import { EMPLOYEE_NAV, EMPLOYEE_NAV_GROUPS } from "@/config/navigation";

/**
 * Employee Panel layout — mirrors the admin layout pattern:
 * call getSession() directly (not via a wrapper component) so the
 * session check + redirect happens before any child renders.
 *
 * ADMIN and EMPLOYEE roles are allowed. STUDENT is redirected to /403.
 * Full authorization is also enforced server-side in API guards.
 */
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role !== "ADMIN" && session.user.role !== "EMPLOYEE") {
    redirect("/403");
  }
  return (
    <AdminShell
      items={EMPLOYEE_NAV}
      navGroups={EMPLOYEE_NAV_GROUPS}
      subtitle="Employee Workspace"
      homeHref="/employee"
      notificationsHref="/employee/notifications"
      settingsHref="/employee/settings"
      userName={session.user.name ?? ""}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AdminShell>
  );
}
