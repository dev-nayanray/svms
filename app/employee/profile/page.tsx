import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { EmptyState, StatusBadge } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PageHeader } from "@/components/shared/page-kit";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: {
      branch: true,
      _count: { select: { students: true, leads: true, appointments: true, conversations: true } },
    },
  });
  if (!employee) {
    return <EmptyState title="No employee profile" description="Ask an admin to create your employee profile." />;
  }

  const initials = (session.user.name ?? session.user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your counselor profile as it appears to students and colleagues."
        breadcrumbs={["Employee", "Profile"]}
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
            {initials}
          </span>
          <div className="min-w-0 text-center sm:text-left">
            <h2 className="text-lg font-semibold">{session.user.name}</h2>
            <p className="text-sm text-muted-foreground">{employee.title ?? "Counselor"}</p>
            <p className="text-sm text-muted-foreground">{session.user.email}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <StatusBadge status="EMPLOYEE" />
            {employee.branch && <StatusBadge status={employee.branch.name} />}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Assigned students" value={employee._count.students} />
            <Row label="Assigned leads" value={employee._count.leads} />
            <Row label="Appointments" value={employee._count.appointments} />
            <Row label="Conversations" value={employee._count.conversations} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Branch" value={employee.branch?.name ?? "—"} />
            <Row label="Member since" value={formatDate(employee.createdAt)} />
            <Row label="Employee ID" value={<span className="font-mono text-xs">{employee.id}</span>} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
