import { redirect } from "next/navigation";
import { EmployeePageHeader, ComingSoonCard } from "@/components/employee/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/reports");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  return (
    <div>
      <EmployeePageHeader
        title="Reports"
        description="Performance insights across your assigned students and applications."
      />
      <ComingSoonCard title="Reports & analytics" />
    </div>
  );
}
