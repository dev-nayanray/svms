import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader, ComingSoonCard } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/applications");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const { id } = await params;

  // Case ownership: foreign applications return 404.
  const isAdmin = role === "ADMIN";
  const application = isAdmin
    ? await prisma.application.findFirst({
        where: { id },
        include: { student: true, country: true, documents: true, tasks: true },
      })
    : await prisma.application.findFirst({
        where: { id, student: { assignedEmployee: { userId: session.user.id } } },
        include: { student: true, country: true, documents: true, tasks: true },
      });

  if (!application) notFound();

  return (
    <div>
      <EmployeePageHeader
        title={application.applicationNumber}
        description={`${application.student.firstName} ${application.student.lastName} · ${application.country?.name ?? "—"}`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Application details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Stage" value={<Badge tone="info">{titleCase(application.stageKey)}</Badge>} />
              <Field label="Status" value={<Badge tone="info">{titleCase(application.status)}</Badge>} />
              <Field label="Student" value={`${application.student.firstName} ${application.student.lastName}`} />
              <Field label="Country" value={application.country?.name ?? "—"} />
              <Field label="Created" value={formatDate(application.createdAt)} />
              <Field label="Last update" value={formatDate(application.updatedAt)} />
            </dl>
            {application.notes && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{application.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Documents & Tasks</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {application.documents.length} document{application.documents.length === 1 ? "" : "s"} · {application.tasks.length} task{application.tasks.length === 1 ? "" : "s"}
            </p>
            <ComingSoonCard title="Full pipeline" />
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
