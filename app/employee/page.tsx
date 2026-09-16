import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { StatCard, EmptyState, StatusBadge } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import {
  Users, FolderKanban, FileText, CheckSquare, CalendarClock,
  AlertTriangle, ArrowRight, Clock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmployeeDashboard() {
  const session = await getSession();
  if (session.user.role === "STUDENT") redirect("/403");
  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    return <EmptyState title="No employee profile" description="Ask an admin to create your employee profile." />;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [
    students,
    myStudentsCount,
    activeApplications,
    pendingDocs,
    pendingDocList,
    todayTasks,
    overdueTasks,
    overdueTaskList,
    upcomingAppointments,
    todayAppointments,
    unreadMessages,
    recentApplications,
    recentActivities,
  ] = await Promise.all([
    prisma.student.findMany({
      where: { assignedEmployeeId: employee.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { applications: { where: { deletedAt: null }, take: 1, orderBy: { createdAt: "desc" } } },
    }),
    prisma.student.count({ where: { assignedEmployeeId: employee.id, deletedAt: null } }),
    prisma.application.count({ where: { deletedAt: null, status: "ACTIVE", employeeId: employee.id } }),
    prisma.document.count({
      where: {
        deletedAt: null,
        status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] },
        student: { assignedEmployeeId: employee.id },
      },
    }),
    prisma.document.findMany({
      where: {
        deletedAt: null,
        status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] },
        student: { assignedEmployeeId: employee.id },
      },
      include: { student: { select: { firstName: true, lastName: true, studentId: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.task.count({
      where: {
        assignedToId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: startOfToday, lt: endOfToday },
      },
    }),
    prisma.task.count({
      where: {
        assignedToId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
    }),
    prisma.task.findMany({
      where: {
        assignedToId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
      include: { student: { select: { firstName: true, lastName: true, studentId: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.appointment.findMany({
      where: {
        employeeId: employee.id,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: { gte: now },
      },
      include: { student: { select: { firstName: true, lastName: true, studentId: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.appointment.count({
      where: {
        employeeId: employee.id,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: { gte: startOfToday, lt: endOfToday },
      },
    }),
    prisma.message.count({
      where: {
        conversation: { employeeId: employee.id },
        senderId: { not: session.user.id },
        readAt: null,
      },
    }),
    prisma.application.findMany({
      where: { deletedAt: null, employeeId: employee.id },
      include: {
        student: { select: { firstName: true, lastName: true, studentId: true } },
        country: { select: { name: true, flag: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const hasAttention = overdueTasks > 0 || pendingDocs > 0 || unreadMessages > 0;

  return (
    <div className="space-y-6">
      {/* ── Personalized header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{greeting}, {firstName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasAttention
              ? "Here's what needs your attention today."
              : "You're all caught up. Here's your overview."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/employee/students">
            <Button variant="outline" size="sm">
              <Users className="h-3.5 w-3.5" /> My Students
            </Button>
          </Link>
          <Link href="/employee/tasks">
            <Button size="sm">
              <CheckSquare className="h-3.5 w-3.5" /> My Tasks
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Needs Attention banner ── */}
      {hasAttention && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:bg-amber-950/10">
          <h2 className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Needs Attention
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {overdueTasks > 0 && (
              <Link href="/employee/tasks" className="group inline-flex items-center gap-2 rounded-lg border border-red-300/50 bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all hover:border-red-400 hover:shadow dark:bg-card">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-red-500/15 text-xs font-bold text-red-600">{overdueTasks}</span>
                Overdue tasks
                <ArrowRight className="h-3 w-3 text-amber-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
            {pendingDocs > 0 && (
              <Link href="/employee/documents" className="group inline-flex items-center gap-2 rounded-lg border border-amber-300/50 bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all hover:border-amber-400 hover:shadow dark:bg-card">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-amber-500/15 text-xs font-bold text-amber-600">{pendingDocs}</span>
                Documents to review
                <ArrowRight className="h-3 w-3 text-amber-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
            {unreadMessages > 0 && (
              <Link href="/employee/messages" className="group inline-flex items-center gap-2 rounded-lg border border-blue-300/50 bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all hover:border-blue-400 hover:shadow dark:bg-card">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-500/15 text-xs font-bold text-blue-600">{unreadMessages}</span>
                Unread messages
                <ArrowRight className="h-3 w-3 text-amber-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="My Students" value={myStudentsCount} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active Applications" value={activeApplications} icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard title="Pending Documents" value={pendingDocs} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Today's Appointments" value={todayAppointments} icon={<CalendarClock className="h-5 w-5" />} />
      </div>

      {/* ── Two-column workspace ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Left: Overdue tasks + pending docs ── */}
        <div className="space-y-4">
          {/* Overdue Tasks */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Overdue Tasks
              </CardTitle>
              <Link href="/employee/tasks" className="text-xs font-medium text-primary hover:underline">
                View all →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueTaskList.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No overdue tasks. Great job!</p>
              )}
              {overdueTaskList.map((task) => (
                <Link
                  key={task.id}
                  href="/employee/tasks"
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/40"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-600">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {task.student ? `${task.student.firstName} ${task.student.lastName}` : "—"}
                      {" · Due "}
                      {formatDate(task.dueDate)}
                    </p>
                  </div>
                  <StatusBadge status={task.priority} />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Pending Documents */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                Documents to Review
              </CardTitle>
              <Link href="/employee/documents" className="text-xs font-medium text-primary hover:underline">
                View all →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingDocList.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No documents pending review.</p>
              )}
              {pendingDocList.map((doc) => (
                <Link
                  key={doc.id}
                  href="/employee/documents"
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/40"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.student.firstName} {doc.student.lastName} · {doc.category}
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Upcoming appointments + recent applications ── */}
        <div className="space-y-4">
          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-blue-500" />
                Upcoming Appointments
              </CardTitle>
              <Link href="/employee/appointments" className="text-xs font-medium text-primary hover:underline">
                View all →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingAppointments.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No upcoming appointments.</p>
              )}
              {upcomingAppointments.map((appt) => (
                <Link
                  key={appt.id}
                  href="/employee/appointments"
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/40"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                    <CalendarClock className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{appt.purpose}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appt.student.firstName} {appt.student.lastName} · {formatDate(appt.scheduledAt)}
                    </p>
                  </div>
                  <StatusBadge status={appt.status} />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Recent Applications */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" />
                Recent Applications
              </CardTitle>
              <Link href="/employee/applications" className="text-xs font-medium text-primary hover:underline">
                View all →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentApplications.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No applications yet.</p>
              )}
              {recentApplications.map((app) => (
                <Link
                  key={app.id}
                  href={`/employee/applications/${app.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/40"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FolderKanban className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {app.student.firstName} {app.student.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.country?.flag ?? ""} {app.country?.name ?? "—"} · {app.applicationNumber}
                    </p>
                  </div>
                  <StatusBadge status={app.stageKey} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Recent students + activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Students */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              My Students
            </CardTitle>
            <Link href="/employee/students" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {students.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No students assigned yet.</p>
            )}
            {students.map((s) => (
              <Link
                key={s.id}
                href={`/employee/students/${s.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/40"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {s.firstName[0]}{s.lastName[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.firstName} {s.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.studentId}</p>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivities.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No recent activity.</p>
            )}
            {recentActivities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b border-border/50 py-2 last:border-0 last:pb-0">
                <span className="mt-0.5 shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {a.action.split(".").pop()?.replace(/_/g, " ").toUpperCase().slice(0, 8)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{a.action}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
