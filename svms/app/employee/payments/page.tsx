import { redirect } from "next/navigation";
import { EmployeePageHeader, ComingSoonCard } from "@/components/employee/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeePaymentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/payments");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  return (
    <div>
      <EmployeePageHeader
        title="Payments"
        description="Track service payments across your assigned students."
      />
      <ComingSoonCard title="Payments ledger" />
    </div>
  );
}
