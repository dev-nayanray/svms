import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, formatMoney } from "@/lib/utils";
import { ChevronLeft, Building2, Users, FolderKanban, CheckSquare, DollarSign } from "lucide-react";
import type { Branch, Employee } from "@prisma/client";

export const dynamic = "force-dynamic";

type BranchDetail = Branch & {
  manager: {
    id: string;
    title: string | null;
    user: { id: string; name: string; email: string };
  } | null;
  employees: (Employee & {
    user: { id: string; name: string; email: string };
  })[];
  _count: {
    students: number;
    employees: number;
    users: number;
  };
};

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const branch = (await prisma.branch.findFirst({
    where: { id },
    include: {
      manager: {
        select: {
          id: true,
          title: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      employees: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
      _count: {
        select: {
          students: { where: { deletedAt: null } },
          employees: { where: { deletedAt: null } },
          users: true,
        },
      },
    },
  })) as BranchDetail | null;

  if (!branch) notFound();

  // Students at this branch (latest 50)
  const students = await prisma.student.findMany({
    where: { branchId: id, deletedAt: null },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Applications for students at this branch (latest 25)
  const studentIds = students.map((s) => s.id);
  const applications = studentIds.length
    ? await prisma.application.findMany({
        where: { studentId: { in: studentIds }, deletedAt: null },
        select: {
          id: true,
          applicationNumber: true,
          stageKey: true,
          status: true,
          priority: true,
          student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
          country: { select: { id: true, name: true, flag: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      })
    : [];

  // Tasks assigned to employees at this branch (latest 25)
  const userIds = branch.employees.map((e) => e.user.id);
  const tasks = userIds.length
    ? await prisma.task.findMany({
        where: { assignedToId: { in: userIds }, deletedAt: null },
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      })
    : [];

  // Revenue + outstanding
  const [revenueAgg, outstandingAgg] = await Promise.all([
    studentIds.length
      ? prisma.payment.aggregate({
          where: { studentId: { in: studentIds }, deletedAt: null, status: "PAID" },
          _sum: { amount: true },
          _count: true,
        })
      : Promise.resolve({ _sum: { amount: 0 }, _count: 0 }),
    studentIds.length
      ? prisma.invoice.aggregate({
          where: {
            studentId: { in: studentIds },
            deletedAt: null,
            status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
          },
          _sum: { dueAmount: true },
          _count: true,
        })
      : Promise.resolve({ _sum: { dueAmount: 0 }, _count: 0 }),
  ]);

  const revenue = revenueAgg._sum.amount ?? 0;
  const outstanding = outstandingAgg._sum.dueAmount ?? 0;

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/branches"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Branches
        </Link>
      </div>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
            {branch.name}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs uppercase">{branch.code}</span>
            {branch.email && <span>· {branch.email}</span>}
            {branch.phone && <span>· {branch.phone}</span>}
          </span>
        }
        breadcrumbs={["Admin", "Branches", branch.name]}
        actions={
          <div className="flex items-center gap-2">
            {branch.deletedAt && <StatusBadge status="ARCHIVED" />}
            <StatusBadge status={branch.status} />
          </div>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Employees", branch._count.employees],
          ["Students", branch._count.students],
          ["Revenue", formatMoney(revenue)],
          ["Outstanding", formatMoney(outstanding)],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "employees", label: `Employees (${branch.employees.length})` },
          { value: "students", label: `Students (${students.length})` },
          { value: "applications", label: `Applications (${applications.length})` },
          { value: "tasks", label: `Tasks (${tasks.length})` },
          { value: "revenue", label: "Revenue" },
        ]}
        defaultValue="overview"
      >
        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Branch details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Name" value={branch.name} />
                <Row label="Code" value={<span className="font-mono uppercase">{branch.code}</span>} />
                <Row label="Address" value={branch.address ?? "—"} />
                <Row label="Phone" value={branch.phone ?? "—"} />
                <Row label="Email" value={branch.email ?? "—"} />
                <Row label="Manager" value={
                  branch.manager
                    ? <Link href={`/admin/employees/${branch.manager.id}`} className="text-primary hover:underline">
                        {branch.manager.user.name}
                      </Link>
                    : "—"
                } />
                <Row label="Status" value={<StatusBadge status={branch.status} />} />
                <Row label="Created" value={formatDate(branch.createdAt)} />
                <Row label="Updated" value={formatDate(branch.updatedAt)} />
                {branch.deletedAt && <Row label="Archived" value={formatDate(branch.deletedAt)} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Performance summary</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Total employees" value={branch._count.employees} />
                <Row label="Total students" value={branch._count.students} />
                <Row label="Active applications" value={applications.length} />
                <Row label="Open tasks" value={tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS").length} />
                <Row label="Total revenue (paid)" value={formatMoney(revenue)} />
                <Row label="Outstanding (due)" value={
                  <span className={outstanding > 0 ? "font-medium text-warning" : ""}>
                    {formatMoney(outstanding)}
                  </span>
                } />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Employees */}
        <TabsContent value="employees" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden />
                Employees at {branch.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {branch.employees.length === 0 ? (
                <EmptyState title="No employees assigned to this branch" />
              ) : (
                <TableShell headers={["Name", "Title", "Email"]}>
                  {branch.employees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/employees/${emp.id}`} className="font-medium text-primary hover:underline">
                          {emp.user.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{emp.title ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{emp.user.email}</td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Students */}
        <TabsContent value="students" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden />
                Students at {branch.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <EmptyState title="No students at this branch" />
              ) : (
                <TableShell headers={["Student", "ID", "Email", "Status", "Joined"]}>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/students/${s.id}`} className="font-medium text-primary hover:underline">
                          {s.firstName} {s.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{s.studentId}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.email}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Applications */}
        <TabsContent value="applications" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4" aria-hidden />
                Applications from {branch.name} students
              </CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <EmptyState title="No applications from this branch" />
              ) : (
                <TableShell headers={["Application", "Student", "Country", "Stage", "Priority"]}>
                  {applications.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/applications/${a.id}`} className="font-mono text-xs text-primary hover:underline">
                          {a.applicationNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/students/${a.student.id}`} className="font-medium text-primary hover:underline">
                          {a.student.firstName} {a.student.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        {a.country.flag && <span aria-hidden>{a.country.flag} </span>}
                        {a.country.name}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={a.stageKey} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={a.priority} /></td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" aria-hidden />
                Tasks assigned to {branch.name} employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <EmptyState title="No tasks assigned to this branch" />
              ) : (
                <TableShell headers={["Title", "Status", "Priority", "Due Date"]}>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2.5 font-medium">{t.title}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={t.priority} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{t.dueDate ? formatDate(t.dueDate) : "—"}</td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue */}
        <TabsContent value="revenue" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" aria-hidden />
                Revenue summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="Total revenue (paid)" value={formatMoney(revenue)} />
                <Row label="Payment count" value={revenueAgg._count} />
                <Row label="Outstanding (due)" value={
                  <span className={outstanding > 0 ? "font-medium text-warning" : ""}>
                    {formatMoney(outstanding)}
                  </span>
                } />
                <Row label="Outstanding invoices" value={outstandingAgg._count} />
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="font-medium">Multi-branch access control</p>
                <p className="mt-1 text-muted-foreground">
                  This branch&apos;s revenue is scoped to students assigned to it. When
                  multi-tenancy lands, the <code>organizationId</code> field on Branch
                  will scope all queries organization-wide, and branch-level access
                  control will filter by the user&apos;s <code>branchId</code>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}
