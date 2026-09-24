import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Root page — redirects to the user's role-based home.
 * - ADMIN → /admin
 * - EMPLOYEE → /employee
 * - STUDENT → /student
 * - Not logged in → /login
 */
export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const home = ROLE_HOME[session.user.role as keyof typeof ROLE_HOME] ?? "/login";
  redirect(home);
}
