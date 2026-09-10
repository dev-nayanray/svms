import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SidebarShell, type NavItem } from "@/components/shared/sidebar-shell";

/** Server layout: enforces role and renders the sidebar shell. */
export async function RoleLayout({
  allowedRoles,
  items,
  title,
  children,
}: {
  allowedRoles: string[];
  items: NavItem[];
  title: string;
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!allowedRoles.includes(session.user.role)) {
    redirect("/403");
  }
  return (
    <SidebarShell items={items} title={title} role={session.user.role} userName={session.user.name ?? ""}>
      {children}
    </SidebarShell>
  );
}
