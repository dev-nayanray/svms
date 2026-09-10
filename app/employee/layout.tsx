import { RoleLayout } from "@/components/shared/role-layout";
import { EMPLOYEE_NAV } from "@/config/navigation";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleLayout allowedRoles={["ADMIN", "EMPLOYEE"]} items={EMPLOYEE_NAV} title="SVMS Workspace">
      {children}
    </RoleLayout>
  );
}
