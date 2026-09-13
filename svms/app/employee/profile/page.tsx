import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/profile");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    include: { user: true },
  });

  return (
    <div>
      <EmployeePageHeader title="My Profile" description="Your employee record and contact details." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Employee information</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Name" value={session.user.name ?? "—"} />
              <Field label="Email" value={session.user.email ?? "—"} />
              <Field label="Title" value={employee?.title ?? "—"} />
              <Field label="Role" value={<Badge tone="info">{role}</Badge>} />
              <Field label="Last login" value={employee?.user?.lastLoginAt ? formatDate(employee.user.lastLoginAt) : "—"} />
              <Field label="Member since" value={employee ? formatDate(employee.createdAt) : "—"} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Profile editing and password changes are coming in a future release.
              To update your contact information, contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
