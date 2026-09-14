import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SidebarShell } from "@/components/shared/sidebar-shell";
import { EMPLOYEE_NAV } from "@/config/navigation";

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
    <SidebarShell
      items={EMPLOYEE_NAV}
      title="Euroscope Workspace"
      role={session.user.role}
      userName={session.user.name ?? ""}
    >
      {children}
    </SidebarShell>
  );
}
