import { redirect } from "next/navigation";
import { EmployeePageHeader, ComingSoonCard } from "@/components/employee/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeAppointmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/appointments");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  return (
    <div>
      <EmployeePageHeader
        title="Appointments"
        description="Manage your upcoming student appointments and consultations."
      />
      <ComingSoonCard title="Appointment calendar" />
    </div>
  );
}
