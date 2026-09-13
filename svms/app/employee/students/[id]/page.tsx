import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmployeePageHeader, ComingSoonCard } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Separator } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/students");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const { id } = await params;

  // Case ownership: EMPLOYEE may only view students assigned to them.
  // Foreign records return 404 — never 403 — so ownership is never confirmed.
  const isAdmin = role === "ADMIN";
  const student = isAdmin
    ? await prisma.student.findFirst({ where: { id }, include: { user: true, applications: true, documents: true } })
    : await prisma.student.findFirst({
        where: { id, assignedEmployee: { userId: session.user.id } },
        include: { user: true, applications: true, documents: true },
      });

  if (!student) notFound();

  return (
    <div>
      <EmployeePageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={`${student.studentId} · ${student.email}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Student information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Email" value={student.email} />
              <Field label="Phone" value={student.phone ?? "—"} />
              <Field label="Country" value={student.country ?? "—"} />
              <Field label="City" value={student.city ?? "—"} />
              <Field label="Date of birth" value={student.dateOfBirth ? formatDate(student.dateOfBirth) : "—"} />
              <Field label="Nationality" value={student.nationality ?? "—"} />
              <Field label="Gender" value={student.gender ? titleCase(student.gender) : "—"} />
              <Field label="Status" value={<Badge tone="info">{titleCase(student.status)}</Badge>} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {student.applications.length} application{student.applications.length === 1 ? "" : "s"} · {student.documents.length} document{student.documents.length === 1 ? "" : "s"}
            </p>
            <Separator className="my-3" />
            <ComingSoonCard title="Full timeline" />
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
