import { redirect } from "next/navigation";
import { EmployeePageHeader, ComingSoonCard } from "@/components/employee/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeVisaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/visa");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  return (
    <div>
      <EmployeePageHeader
        title="Visa Management"
        description="Track visa preparation, appointments, biometrics, and decisions for your students."
      />
      <ComingSoonCard title="Visa pipeline" />
    </div>
  );
}
