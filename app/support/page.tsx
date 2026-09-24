import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Public /support route — role-aware redirect.
 *
 * This fixes the "Support → Admin" bug. Previously, there was no public
 * /support route — students looking for support had no clear path, and
 * clicking "Admin Platform" in the footer sent them to /admin (which
 * the proxy then redirected to /student, but NOT /student/support).
 *
 * Now:
 *  - Logged-out → /contact (public contact form)
 *  - Student → /student/support (student help center + tickets)
 *  - Employee → /employee/support (employee support management)
 *  - Admin → /admin/support (admin support ticket management)
 */
export default async function SupportRedirectPage() {
  const session = await auth();

  if (!session?.user?.role) {
    redirect("/contact");
  }

  const role = session.user.role;
  if (role === "ADMIN") {
    redirect("/admin/support");
  }
  if (role === "EMPLOYEE") {
    redirect("/employee/support");
  }
  redirect("/student/support");
}
