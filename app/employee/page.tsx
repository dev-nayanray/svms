import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { StatCard, EmptyState, StatusBadge } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Users, FolderKanban, FileText, CheckSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeDashboard() {
  const session = await getSession();
  if (session.user.role === "STUDENT") redirect("/403");
  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    return <EmptyState title="No employee profile" description="Ask an admin to create your employee profile." />;
  }

  const [students, applications, pendingDocs, todayTasks, overdueTasks] = await Promise.all([
    prisma.student.findMany({
      where: { assignedEmployeeId: employee.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.application.count({
      where: { deletedAt: null, status: "ACTIVE", employeeId: employee.id },
    }),
    prisma.document.count({
      where: {
        deletedAt: null,
        status: { in: ["UPLOADED", "UNDER_REVIEW"] },
        student: { assignedEmployeeId: employee.id },
      },
    }),
    prisma.task.findMany({
      where: {
        assignedToId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      take: 6,
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.count({
      where: {
        assignedToId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  const myStudentsCount = await prisma.student.count({
    where: { assignedEmployeeId: employee.id, deletedAt: null },
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Welcome back, {session.user.name}</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="My Students" value={myStudentsCount} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active Applications" value={applications} icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard title="Pending Documents" value={pendingDocs} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Overdue Tasks" value={overdueTasks} icon={<CheckSquare className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {students.length === 0 && <EmptyState title="No students assigned yet" />}
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{s.firstName} {s.lastName}</span>
                  <span className="text-muted-foreground"> · {s.studentId}</span>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.length === 0 && <EmptyState title="No tasks due today" />}
            {todayTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{t.title}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{formatDate(t.dueDate)}</span>
                  <StatusBadge status={t.priority} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
