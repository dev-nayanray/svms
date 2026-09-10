import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/shared/admin-shell";
import { ADMIN_NAV } from "@/config/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role !== "ADMIN") redirect("/403");
  return (
    <AdminShell
      items={ADMIN_NAV}
      userName={session.user.name ?? ""}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AdminShell>
  );
}
