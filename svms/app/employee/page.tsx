import Link from "next/link";
import {
  Users, FolderKanban, FileText, Stamp, CheckSquare, CalendarClock,
  AlertTriangle, Clock, CreditCard, UserPlus, FolderPlus, FileUp,
  Plus, MessageSquare, CalendarPlus, ArrowRight,
} from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";
import {
  getEmployeeDashboard,
  type EmployeeScope,
  type StageBucket,
  type PendingDocument,
  type DeadlineItem,
  type GroupedTasks,
  type TaskRow as TaskRowType,
  type AppointmentRow,
  type ActivityItem,
} from "@/lib/services/employee-dashboard";
import { EmployeePageHeader, StatCard } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { DateRangeFilter } from "@/components/employee/date-range-filter";
import { formatDate, titleCase, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS: { label: string; href: string; icon: typeof UserPlus; permission?: PermissionKey }[] = [
  { label: "Add Lead", href: "/employee/leads", icon: UserPlus, permission: "leads.manage" },
  { label: "Add Student", href: "/employee/students", icon: Users, permission: "students.create" },
  { label: "Create Application", href: "/employee/applications", icon: FolderPlus, permission: "applications.update" },
  { label: "Request Document", href: "/employee/documents", icon: FileUp, permission: "documents.review" },
  { label: "Create Task", href: "/employee/tasks", icon: Plus, permission: "tasks.manage" },
  { label: "Schedule Appointment", href: "/employee/appointments", icon: CalendarPlus, permission: "tasks.manage" },
  { label: "Send Message", href: "/employee/messages", icon: MessageSquare, permission: "messages.create" },
];

export default async function EmployeeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string;
    from?: string;
    to?: string;
    tz?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  const sp = await searchParams;
  const range = resolveDashboardRange({
    preset: sp.preset,
    from: sp.from,
    to: sp.to,
    tz: sp.tz,
  });

  // Resolve Employee record for case ownership. ADMIN skips — global scope.
  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }

  // Compute the caller's permissions so we can filter KPIs + quick actions.
  const perms = {
    students: hasPermission(role, "students.read"),
    leads: hasPermission(role, "leads.read"),
    applications: hasPermission(role, "applications.read"),
    documents: hasPermission(role, "documents.read"),
    visa: hasPermission(role, "visa.read"),
    tasks: hasPermission(role, "tasks.read"),
    appointments: hasPermission(role, "tasks.read"),
    payments: hasPermission(role, "payments.read"),
    invoices: hasPermission(role, "invoices.read"),
  };

  const scope: EmployeeScope = {
    isAdmin: role === "ADMIN",
    userId: session.user.id,
    employeeId,
  };

  let dashboard;
  try {
    dashboard = await getEmployeeDashboard(scope, range, perms);
  } catch (err) {
    console.error("[employee-dashboard]", err);
    return <DashboardError />;
  }

  const { kpis, pipeline, visaCases, pendingDocuments, upcomingDeadlines, myTasks, upcomingAppointments, recentActivity } =
    dashboard;

  return (
    <div>
      <EmployeePageHeader
        title={`Welcome back, ${session.user.name?.split(" ")[0] ?? "Employee"}`}
        description={`Your case overview · ${range.label}`}
        actions={<DateRangeFilter activePreset={range.preset} customFrom={sp.from} customTo={sp.to} />}
      />

      {/* KPI CARDS */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {perms.students && (
          <StatCard label="My Students" value={kpis.myStudents} hint="Assigned" tone="info" />
        )}
        {perms.applications && (
          <StatCard label="Active Applications" value={kpis.activeApplications} hint="In progress" tone="success" />
        )}
        {perms.leads && (
          <StatCard label="New Leads" value={kpis.newLeads} hint={range.label} tone="default" />
        )}
        {perms.documents && (
          <StatCard label="Pending Documents" value={kpis.pendingDocuments} hint="Awaiting review" tone="warning" />
        )}
        {perms.visa && (
          <>
            <StatCard label="Visa Applications" value={kpis.visaApplications} hint="Total" tone="default" />
            <StatCard label="Visa Submitted" value={kpis.visaSubmitted} hint="In process" tone="info" />
            <StatCard label="Visa Approved" value={kpis.visaApproved} hint="Decided" tone="success" />
          </>
        )}
        {perms.tasks && (
          <>
            <StatCard label="Pending Tasks" value={kpis.pendingTasks} hint="Open" tone="warning" />
            <StatCard label="Overdue Tasks" value={kpis.overdueTasks} hint="Past due" tone="destructive" />
          </>
        )}
        {perms.appointments && (
          <StatCard label="Upcoming Appts" value={kpis.upcomingAppointments} hint="Scheduled" tone="info" />
        )}
        {perms.payments && (
          <StatCard label="Outstanding Payments" value={kpis.outstandingPayments} hint="Pending" tone="destructive" />
        )}
      </section>

      {/* QUICK ACTIONS */}
      <section aria-label="Quick actions" className="mt-6">
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.filter((a) => !a.permission || hasPermission(role, a.permission)).map((action) => (
            <Link key={action.label} href={action.href}>
              <Button variant="outline" size="sm">
                <action.icon className="h-3.5 w-3.5" aria-hidden /> {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Application pipeline */}
          {perms.applications && <PipelineWidget buckets={pipeline} />}

          {/* Pending documents */}
          {perms.documents && <PendingDocumentsWidget documents={pendingDocuments} />}

          {/* Upcoming deadlines */}
          <UpcomingDeadlinesWidget deadlines={upcomingDeadlines} />

          {/* My tasks */}
          {perms.tasks && <MyTasksWidget tasks={myTasks} />}
        </div>

        <div className="space-y-6">
          {/* Visa cases */}
          {perms.visa && <VisaCasesWidget buckets={visaCases} />}

          {/* Upcoming appointments */}
          {perms.appointments && <UpcomingAppointmentsWidget appointments={upcomingAppointments} />}

          {/* Recent activity */}
          <RecentActivityWidget items={recentActivity} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Widgets
// ─────────────────────────────────────────────

function PipelineWidget({ buckets }: { buckets: StageBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>My Application Pipeline</CardTitle>
        <Link href="/employee/applications">
          <Button variant="ghost" size="sm">All applications <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {buckets.map((b) => (
            <Link
              key={b.stage}
              href={`/employee/applications?stage=${b.stage}`}
              className="group rounded-md border border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  {titleCase(b.stage)}
                </p>
                <span className="text-sm font-bold tabular-nums">{b.count}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingDocumentsWidget({ documents }: { documents: PendingDocument[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pending Documents</CardTitle>
        <Link href="/employee/documents">
          <Button variant="ghost" size="sm">All documents <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {documents.length === 0 ? (
          <EmptyRow label="No pending documents" />
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((d) => (
              <li key={d.id} className="grid grid-cols-12 items-center gap-2 p-4">
                <div className="col-span-5 min-w-0">
                  <p className="truncate text-sm font-medium">{d.studentName}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.documentName}</p>
                </div>
                <div className="col-span-3">
                  <Badge tone={d.status === "REQUESTED" ? "warning" : "info"}>{titleCase(d.status)}</Badge>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {d.uploadedAt ? `Uploaded ${formatDate(d.uploadedAt)}` : "Not uploaded"}
                </div>
                <div className="col-span-2 text-right">
                  <Link href="/employee/documents">
                    <Button variant="ghost" size="sm">Review</Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingDeadlinesWidget({ deadlines }: { deadlines: DeadlineItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Deadlines</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {deadlines.length === 0 ? (
          <EmptyRow label="No upcoming deadlines in this range" />
        ) : (
          <ul className="divide-y divide-border">
            {deadlines.map((d, i) => {
              const overdue = d.due < new Date();
              return (
                <li key={i} className="flex items-center gap-3 p-4">
                  <span className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-md",
                    overdue ? "bg-destructive/10 text-destructive" : d.kind === "visa" ? "bg-info/10 text-info" : "bg-warning/10 text-warning",
                  )}>
                    {overdue ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {overdue ? "Overdue · " : "Due "}{formatDate(d.due)} · {titleCase(d.kind)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MyTasksWidget({ tasks }: { tasks: GroupedTasks }) {
  const all = [...tasks.overdue, ...tasks.today, ...tasks.upcoming];
  if (all.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My Tasks</CardTitle>
          <Link href="/employee/tasks"><Button variant="ghost" size="sm">All tasks <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button></Link>
        </CardHeader>
        <CardContent><EmptyRow label="No open tasks" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>My Tasks</CardTitle>
        <Link href="/employee/tasks"><Button variant="ghost" size="sm">All tasks <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button></Link>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {tasks.overdue.length > 0 && (
            <li className="bg-destructive/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-destructive">Overdue</li>
          )}
          {tasks.overdue.map((t) => <TaskRow key={t.id} task={t} overdue />)}
          {tasks.today.length > 0 && (
            <li className="bg-warning/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-warning">Today</li>
          )}
          {tasks.today.map((t) => <TaskRow key={t.id} task={t} />)}
          {tasks.upcoming.length > 0 && (
            <li className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</li>
          )}
          {tasks.upcoming.map((t) => <TaskRow key={t.id} task={t} />)}
        </ul>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, overdue }: { task: TaskRowType; overdue?: boolean }) {
  return (
    <li className="flex items-center gap-3 p-4">
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", overdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
        <CheckSquare className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {task.studentName ?? "—"} · {task.dueDate ? formatDate(task.dueDate) : "No due date"} · {titleCase(task.priority)}
        </p>
      </div>
      <Badge tone={overdue ? "destructive" : "info"}>{titleCase(task.status)}</Badge>
    </li>
  );
}

function VisaCasesWidget({ buckets }: { buckets: StageBucket[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Visa Cases</CardTitle>
        <Link href="/employee/visa"><Button variant="ghost" size="sm">All <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button></Link>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {buckets.map((b) => (
            <li key={b.stage} className="flex items-center justify-between p-3">
              <span className="text-sm font-medium">{titleCase(b.stage)}</span>
              <Badge tone={b.stage === "APPROVED" ? "success" : b.stage === "REFUSED" ? "destructive" : "info"}>{b.count}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function UpcomingAppointmentsWidget({ appointments }: { appointments: AppointmentRow[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming Appointments</CardTitle>
        <Link href="/employee/appointments"><Button variant="ghost" size="sm">All <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button></Link>
      </CardHeader>
      <CardContent className="p-0">
        {appointments.length === 0 ? (
          <EmptyRow label="No upcoming appointments" />
        ) : (
          <ul className="divide-y divide-border">
            {appointments.map((a) => (
              <li key={a.id} className="flex items-start gap-3 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <CalendarClock className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.studentName}</p>
                  <p className="text-xs text-muted-foreground">{a.title} · {titleCase(a.type)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(a.scheduledAt)} · {a.durationMinutes}m</p>
                </div>
                <Badge tone="info">{titleCase(a.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityWidget({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyRow label="No recent activity" />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((a, i) => (
              <li key={i} className="flex items-start gap-3 p-4">
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md",
                  a.kind === "lead" ? "bg-info/10 text-info"
                    : a.kind === "application" ? "bg-primary/10 text-primary"
                    : a.kind === "document" ? "bg-warning/10 text-warning"
                    : a.kind === "task" ? "bg-success/10 text-success"
                    : a.kind === "payment" ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground",
                )}>
                  <ActivityIcon kind={a.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">{formatDate(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  const Icon = kind === "lead" ? FolderKanban
    : kind === "application" ? FolderKanban
    : kind === "document" ? FileText
    : kind === "task" ? CheckSquare
    : kind === "payment" ? CreditCard
    : kind === "appointment" ? CalendarClock
    : Stamp;
  return <Icon className="h-4 w-4" aria-hidden />;
}

function EmptyRow({ label }: { label: string }) {
  return <p className="p-6 text-center text-sm text-muted-foreground">{label}</p>;
}

function DashboardError() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-sm font-semibold">Could not load your dashboard</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        A server error occurred while computing your metrics. Try refreshing the page.
      </p>
    </div>
  );
}
