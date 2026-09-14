import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { formatDate, formatMoney } from "@/lib/utils";
import { computeTaskStats } from "@/lib/utils/employee-insights";
import { AssignPanels } from "@/components/admin/assign-panels";
import { SimpleBarChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: true,
      branch: true,
      students: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!employee) notFound();

  // Performance metrics — all real database aggregates for this counselor
  const [
    applications,
    tasks,
    documentsReviewed,
    visaSubmissions,
    visaApprovals,
    pendingDocs,
    revenueGenerated,
  ] = await Promise.all([
    prisma.application.findMany({
      where: { employeeId: employee.id, deletedAt: null },
      include: { student: true, country: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({ where: { assignedToId: employee.userId } }),
    prisma.document.count({ where: { reviewedById: employee.userId } }),
    prisma.application.count({
      where: {
        employeeId: employee.id,
        deletedAt: null,
        stageKey: { in: ["VISA_SUBMITTED", "BIOMETRICS", "INTERVIEW", "VISA_DECISION", "TRAVEL_PREPARATION", "COMPLETED"] },
      },
    }),
    prisma.application.count({
      where: { employeeId: employee.id, deletedAt: null, stageKey: "COMPLETED" },
    }),
    prisma.document.count({
      where: {
        deletedAt: null,
        status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] },
        student: { assignedEmployeeId: employee.id },
      },
    }),
    prisma.payment.aggregate({
      where: { deletedAt: null, status: "PAID", application: { employeeId: employee.id } },
      _sum: { amount: true },
    }),
  ]);

  const assignedCases = applications.length;
  const activeCases = applications.filter((a) => a.status === "ACTIVE").length;
  const completedCases = applications.filter((a) => a.stageKey === "COMPLETED").length;
  const { pending: pendingTasks, overdue: overdueTasks } = computeTaskStats(tasks);

  const metrics: [string, number | string][] = [
    ["Assigned Cases", assignedCases],
    ["Active Cases", activeCases],
    ["Completed Cases", completedCases],
    ["Visa Submissions", visaSubmissions],
    ["Visa Approvals", visaApprovals],
    ["Pending Tasks", pendingTasks],
    ["Overdue Tasks", overdueTasks],
    ["Documents Reviewed", documentsReviewed],
  ];

  const chartData = [
    { name: "Assigned", value: assignedCases },
    { name: "Active", value: activeCases },
    { name: "Completed", value: completedCases },
    { name: "Visa Sub.", value: visaSubmissions },
    { name: "Visa Appr.", value: visaApprovals },
    { name: "Docs Rev.", value: documentsReviewed },
    { name: "Overdue", value: overdueTasks },
  ].filter((d) => d.value > 0);

  return (
    <>
      <PageHeader
        title={employee.user.name}
        description={`${employee.title ?? "Counselor"} · ${employee.user.email}`}
        breadcrumbs={["Admin", "Employees", employee.user.name]}
        actions={<StatusBadge status={employee.user.status} />}
      />

      {/* Performance dashboard */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className={`mt-1 text-2xl font-semibold ${label === "Overdue Tasks" && typeof value === "number" && value > 0 ? "text-destructive" : ""}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Case overview strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([
          ["Assigned Students", employee.students.length],
          ["Active Applications", activeCases],
          ["Completed Applications", completedCases],
          ["Pending Documents", pendingDocs],
        ] as [string, number][]).map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Personal information + contact + role + branch + joining date + status */}
        <Card>
          <CardHeader><CardTitle>Employee Profile</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Name" value={employee.user.name} />
            <Row label="Email" value={employee.user.email} />
            <Row label="Phone" value={employee.user.phone ?? "—"} />
            <Row label="Role" value={<StatusBadge status={employee.user.roleName} />} />
            <Row label="Branch" value={employee.branch?.name ?? "—"} />
            <Row label="Joining Date" value={formatDate(employee.createdAt)} />
            <Row label="Status" value={<StatusBadge status={employee.user.status} />} />
            <Row label="Last Login" value={employee.user.lastLoginAt ? formatDate(employee.user.lastLoginAt) : "—"} />
          </CardContent>
        </Card>

        {/* Tasks + revenue */}
        <Card>
          <CardHeader><CardTitle>Workload</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Open tasks" value={pendingTasks} />
            <Row label="Overdue tasks" value={overdueTasks} tone={overdueTasks > 0 ? "danger" : undefined} />
            <Row label="Pending documents (students)" value={pendingDocs} />
            <Row label="Revenue generated (paid)" value={formatMoney(revenueGenerated._sum.amount ?? 0)} />
          </CardContent>
        </Card>
      </div>

      {/* Assign / reassign */}
      <AssignPanels employeeId={employee.id} />

      {/* Assigned students */}
      <Card>
        <CardHeader><CardTitle>Assigned Students</CardTitle></CardHeader>
        <CardContent>
          {employee.students.length === 0 ? <EmptyState title="No students assigned" /> : (
            <TableShell headers={["Student", "ID", "Status", "Created"]}>
              {employee.students.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/students/${s.id}`} className="font-medium text-primary hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{s.studentId}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Assigned applications */}
      <Card>
        <CardHeader><CardTitle>Assigned Applications</CardTitle></CardHeader>
        <CardContent>
          {applications.length === 0 ? <EmptyState title="No applications assigned" /> : (
            <TableShell headers={["Number", "Student", "Country", "Stage", "Status"]}>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/applications/${a.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {a.applicationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{a.student.firstName} {a.student.lastName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.country.name}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={a.stageKey} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Performance chart (client component rendered from server) */}
      <Card>
        <CardHeader><CardTitle>Performance Overview</CardTitle></CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState title="No performance data yet" description="Metrics fill in as the counselor works cases." />
          ) : (
            <EmployeePerformanceChart data={chartData} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "danger" }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`min-w-0 truncate text-right font-medium ${tone === "danger" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}

function EmployeePerformanceChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="text-sm text-muted-foreground">
      <SimpleBarChart data={data} />
      <p className="mt-2 text-xs">
        Metrics: {data.map((d) => `${d.name}: ${d.value}`).join(" · ")}
      </p>
    </div>
  );
}
