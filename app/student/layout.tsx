import { RoleLayout } from "@/components/shared/role-layout";
import { STUDENT_NAV } from "@/config/navigation";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleLayout allowedRoles={["ADMIN", "STUDENT"]} items={STUDENT_NAV} title="My Portal">
      {children}
    </RoleLayout>
  );
}
