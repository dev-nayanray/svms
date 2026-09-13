import { redirect } from "next/navigation";
import { EmployeePageHeader, ComingSoonCard } from "@/components/employee/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeInvoicesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/invoices");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  return (
    <div>
      <EmployeePageHeader
        title="Invoices"
        description="Review invoices issued to your assigned students."
      />
      <ComingSoonCard title="Invoice list" />
    </div>
  );
}
