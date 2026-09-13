import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/permissions";

/**
 * Root route — sends authenticated users into their role's panel and
 * unauthenticated users to the marketing homepage.
 *
 * Authentication + role are resolved server-side here; the marketing
 * homepage itself is also a server component so it can be statically
 * rendered without leaking any session data into the bundle.
 */
export default async function RootPage() {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: string }).role ?? "STUDENT";
    redirect(ROLE_HOME[role as keyof typeof ROLE_HOME] ?? "/student");
  }
  redirect("/home");
}
