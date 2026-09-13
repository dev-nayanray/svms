import Link from "next/link";
import { ArrowRight, Clock, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmployeePageHeader, StatCard } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeeDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  // ADMIN sees global scope; EMPLOYEE sees only their assigned records.
  // Each query builds its own scope filter — Prisma's union types reject
  // the loose `OR` cross-model scope, so we branch per query instead.
  const isAdmin = role === "ADMIN";
  const studentScope = isAdmin ? {} : { assignedEmployee: { userId: session.user.id } };
  const leadScope = isAdmin ? {} : { assignedEmployee: { userId: session.user.id } };
  const applicationScope = isAdmin ? {} : { student: { assignedEmployee: { userId: session.user.id } } };
  const taskScope = isAdmin ? {} : { assignedToId: session.user.id };

  const [studentsCount, leadsCount, applicationsCount, openTasks, recentLeads, upcomingTasks, notifications] =
    await Promise.all([
      prisma.student.count({ where: studentScope }),
      prisma.lead.count({ where: leadScope }),
      prisma.application.count({ where: applicationScope }),
      prisma.task.count({
        where: {
          ...taskScope,
          status: { in: ["TODO", "IN_PROGRESS"] },
        },
      }),
      prisma.lead.findMany({
        where: leadScope,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, status: true, createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          ...taskScope,
          status: { in: ["TODO", "IN_PROGRESS"] },
          dueDate: { not: null },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: { id: true, title: true, dueDate: true, priority: true, status: true },
      }),
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, title: true, message: true, readAt: true, createdAt: true, link: true },
      }),
    ]);

  return (
    <div>
      <EmployeePageHeader
        title={`Welcome back, ${session.user.name?.split(" ")[0] ?? "Employee"}`}
        description="Your case overview for today — students, applications, tasks, and recent activity."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="My Students" value={studentsCount} hint="Assigned to you" tone="info" />
        <StatCard label="Open Leads" value={leadsCount} hint="Need follow-up" tone="default" />
        <StatCard label="Applications" value={applicationsCount} hint="In progress" tone="success" />
        <StatCard label="Open Tasks" value={openTasks} hint="Pending action" tone="warning" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent leads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent leads</CardTitle>
              <Link href="/employee/leads">
                <Button variant="ghost" size="sm">View all <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentLeads.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No leads yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentLeads.map((lead) => (
                    <li key={lead.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">Added {formatDate(lead.createdAt)}</p>
                      </div>
                      <Badge tone="info">{titleCase(lead.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Upcoming tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Upcoming tasks</CardTitle>
              <Link href="/employee/tasks">
                <Button variant="ghost" size="sm">All tasks <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingTasks.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No upcoming tasks.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcomingTasks.map((task) => {
                    const overdue = task.dueDate && task.dueDate < new Date();
                    return (
                      <li key={task.id} className="flex items-center gap-3 p-4">
                        <span className={
                          overdue ? "grid h-8 w-8 place-items-center rounded-md bg-destructive/10 text-destructive"
                            : "grid h-8 w-8 place-items-center rounded-md bg-warning/10 text-warning"
                        }>
                          {overdue ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Due {formatDate(task.dueDate)} · {titleCase(task.priority)}
                          </p>
                        </div>
                        <Badge tone={overdue ? "destructive" : "warning"}>{overdue ? "Overdue" : "Due"}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Notifications</CardTitle>
            <Link href="/employee/notifications">
              <Button variant="ghost" size="sm">All <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No notifications.</p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => (
                  <li key={n.id} className="p-4">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">{formatDate(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
