import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StatCard, EmptyState, StatusBadge } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PageHeader } from "@/components/shared/page-kit";
import { Users, Target, FolderKanban, CheckSquare, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LEAD_STATUSES = ["NEW", "CONTACTED", "COUNSELING", "QUALIFIED", "CONVERTED", "LOST"];

export default async function PerformancePage() {
  const session = await getSession();
  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    return <EmptyState title="No employee profile" description="Ask an admin to create your employee profile." />;
  }

  const monthStart = new Date(new Date().setDate(1));
  monthStart.setHours(0, 0, 0, 0);

  const [myStudents, activeStudents, myLeads, convertedLeads, myApplications, wonApplications, openTasks, doneTasks, tasksThisMonth] =
    await Promise.all([
      prisma.student.count({ where: { assignedEmployeeId: employee.id, deletedAt: null } }),
      prisma.student.count({ where: { assignedEmployeeId: employee.id, deletedAt: null, status: "ACTIVE" } }),
      prisma.lead.count({ where: { assignedEmployeeId: employee.id, deletedAt: null } }),
      prisma.lead.count({ where: { assignedEmployeeId: employee.id, deletedAt: null, status: "CONVERTED" } }),
      prisma.application.count({ where: { employeeId: employee.id, deletedAt: null } }),
      prisma.application.count({ where: { employeeId: employee.id, deletedAt: null, status: "COMPLETED" } }),
      prisma.task.count({ where: { assignedToId: session.user.id, status: { in: ["TODO", "IN_PROGRESS"] } } }),
      prisma.task.count({ where: { assignedToId: session.user.id, status: "COMPLETED" } }),
      prisma.task.findMany({
        where: { assignedToId: session.user.id, completedAt: { gte: monthStart } },
        orderBy: { completedAt: "desc" },
        take: 8,
      }),
    ]);

  const leadConversion = myLeads > 0 ? Math.round((convertedLeads / myLeads) * 100) : 0;
  const winRate = myApplications > 0 ? Math.round((wonApplications / myApplications) * 100) : 0;
  const taskCompletion = openTasks + doneTasks > 0 ? Math.round((doneTasks / (openTasks + doneTasks)) * 100) : 0;

  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    where: { assignedEmployeeId: employee.id, deletedAt: null },
    _count: { _all: true },
  });
  const statusCount = Object.fromEntries(leadsByStatus.map((l) => [l.status, l._count._all]));
  const maxCount = Math.max(1, ...leadsByStatus.map((l) => l._count._all));

  return (
    <>
      <PageHeader
        title="Performance"
        description="Your pipeline health: student portfolio, lead conversion, application win rate, and task throughput."
        breadcrumbs={["Employee", "Performance"]}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="My Students" value={myStudents} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active Students" value={activeStudents} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Lead Conversion" value={`${leadConversion}%`} icon={<Target className="h-5 w-5" />} />
        <StatCard title="Application Win Rate" value={`${winRate}%`} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leadsByStatus.length === 0 && <EmptyState title="No leads assigned yet" />}
            {LEAD_STATUSES.filter((s) => statusCount[s]).map((s) => (
              <div key={s} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <StatusBadge status={s} />
                  <span className="font-medium">{statusCount[s]}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(statusCount[s] / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Throughput</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold">{doneTasks}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold">{openTasks}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold">{taskCompletion}%</p>
                <p className="text-xs text-muted-foreground">Completion</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Completed this month
              </p>
              {tasksThisMonth.length === 0 && <EmptyState title="No tasks completed this month" />}
              <ul className="space-y-1.5">
                {tasksThisMonth.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(t.completedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                {myApplications}
              </div>
              <p className="text-xs text-muted-foreground">Total handled</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-center gap-2 text-2xl font-bold text-success">
                <CheckSquare className="h-5 w-5" />
                {wonApplications}
              </div>
              <p className="text-xs text-muted-foreground">Won</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leads assigned</span>
              <span className="font-medium">{myLeads}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leads converted to students</span>
              <span className="font-medium">{convertedLeads}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tasks completed this month</span>
              <span className="font-medium">{tasksThisMonth.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
