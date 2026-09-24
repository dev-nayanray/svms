import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FolderKanban, CheckSquare,
  Stamp, Clock, Mail, Plus, CalendarPlus, FileUp,
  UserRound, GraduationCap, Building2, BookOpen, Globe, AlertTriangle,
  ChevronRight, MapPin,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Separator } from "@/components/ui";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, formatMoney, titleCase, cn, initials } from "@/lib/utils";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";
import { requireApplication, type ApplicationDetail } from "@/lib/services/application-cases";
import { StageChanger } from "@/components/employee/stage-changer";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "timeline", label: "Timeline" },
  { value: "documents", label: "Documents" },
  { value: "tasks", label: "Tasks" },
  { value: "payments", label: "Payments" },
  { value: "visa", label: "Visa" },
  { value: "messages", label: "Messages" },
  { value: "notes", label: "Notes" },
] as const;

export default async function EmployeeApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/applications");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }

  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const perms = {
    edit: hasPermission(role, "applications.update"),
    viewDocs: hasPermission(role, "documents.read"),
    reviewDocs: hasPermission(role, "documents.review"),
    viewPayments: hasPermission(role, "payments.read"),
    viewInvoices: hasPermission(role, "invoices.read"),
    viewTasks: hasPermission(role, "tasks.read"),
    viewMessages: hasPermission(role, "messages.read"),
    createTask: hasPermission(role, "tasks.manage"),
    message: hasPermission(role, "messages.create"),
    seeInternal: hasPermission(role, "audit.read"),
  };

  const { id } = await params;
  let app: ApplicationDetail;
  try {
    app = await requireApplication(scope, id);
  } catch {
    notFound();
  }

  const sp = await searchParams;
  const activeTab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "overview";

  return (
    <div>
      <Link href="/employee/applications" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Applications
      </Link>

      <ApplicationHeader app={app} />

      {/* Stage pipeline */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</p>
          <div className="flex flex-wrap gap-1">
            {APPLICATION_STAGES.map((stage, i) => {
              const currentIdx = APPLICATION_STAGES.indexOf(app.stageKey as (typeof APPLICATION_STAGES)[number]);
              const isPast = i < currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={stage} className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium",
                      isCurrent ? "bg-primary text-primary-foreground"
                        : isPast ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {titleCase(stage)}
                  </span>
                  {i < APPLICATION_STAGES.length - 1 && <span className="text-muted-foreground/40">→</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2">
          <Tabs tabs={TABS.map((t) => ({ value: t.value, label: t.label }))} defaultValue={activeTab}>
            <TabsContent value="overview">
              <OverviewTab app={app} />
            </TabsContent>
            <TabsContent value="timeline">
              <TimelineTab app={app} canSeeInternal={perms.seeInternal} />
            </TabsContent>
            <TabsContent value="documents">
              {perms.viewDocs ? <DocumentsTab app={app} perms={perms} /> : <UnauthorizedTab />}
            </TabsContent>
            <TabsContent value="tasks">
              {perms.viewTasks ? <TasksTab app={app} perms={perms} /> : <UnauthorizedTab />}
            </TabsContent>
            <TabsContent value="payments">
              {perms.viewPayments ? <PaymentsTab app={app} /> : <UnauthorizedTab />}
            </TabsContent>
            <TabsContent value="visa">
              <VisaTab app={app} />
            </TabsContent>
            <TabsContent value="messages">
              {perms.viewMessages ? <MessagesTab app={app} perms={perms} /> : <UnauthorizedTab />}
            </TabsContent>
            <TabsContent value="notes">
              <NotesTab app={app} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <NextActionCard app={app} />

          <SidebarStudentSummary app={app} />

          <Card>
            <CardHeader><CardTitle>Stage</CardTitle></CardHeader>
            <CardContent>
              <StageChanger applicationId={app.id} currentStage={app.stageKey} canEdit={perms.edit} />
            </CardContent>
          </Card>

          <SidebarQuickActions app={app} perms={perms} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Header — all 12 metadata fields
// ─────────────────────────────────────────────

function ApplicationHeader({ app }: { app: ApplicationDetail }) {
  return (
    <Card className="mb-4 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{app.applicationNumber}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {app.student.firstName} {app.student.lastName} · {app.student.studentId}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone="info">{titleCase(app.stageKey)}</Badge>
              <Badge tone={app.status === "COMPLETED" ? "success" : app.status === "CANCELLED" ? "destructive" : "default"}>{titleCase(app.status)}</Badge>
              <Badge tone={app.priority === "URGENT" || app.priority === "HIGH" ? "destructive" : app.priority === "MEDIUM" ? "warning" : "default"}>{app.priority}</Badge>
              {app.archivedAt && <Badge tone="warning">Archived</Badge>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:text-right">
            <MetaItem label="Country" value={app.country?.name ?? "—"} icon={<Globe className="h-3 w-3" />} />
            <MetaItem label="University" value={app.university?.name ?? "—"} icon={<Building2 className="h-3 w-3" />} />
            <MetaItem label="Course" value={app.course?.name ?? "—"} icon={<BookOpen className="h-3 w-3" />} />
            <MetaItem label="Intake" value={app.intake?.name ?? "—"} icon={<CalendarPlus className="h-3 w-3" />} />
            <MetaItem label="Assignee" value={app.assignedEmployee?.user.name ?? "—"} icon={<UserRound className="h-3 w-3" />} />
            <MetaItem label="Deadline" value={app.deadline ? formatDate(app.deadline) : "—"} tone={app.deadline && app.deadline < new Date() ? "destructive" : undefined} />
            <MetaItem label="Next action" value={app.nextAction?.title ?? "—"} />
            <MetaItem label="Created" value={formatDate(app.createdAt)} />
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaItem({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: "destructive" }) {
  return (
    <div className="md:text-right">
      <dt className="flex items-center justify-end gap-1 text-muted-foreground md:flex-row-reverse">
        {icon}{label}
      </dt>
      <dd className={cn("mt-0.5 font-medium", tone === "destructive" && "text-destructive")}>{value}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar — Next Action card
// ─────────────────────────────────────────────

function NextActionCard({ app }: { app: ApplicationDetail }) {
  const action = app.nextAction;
  const overdue = action?.dueDate && action.dueDate < new Date();
  return (
    <Card className={cn(overdue && "border-destructive/30 bg-destructive/5")}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Next Action</CardTitle>
        {overdue && <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />}
      </CardHeader>
      <CardContent>
        {action ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{action.title}</p>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Responsible</dt>
                <dd className="font-medium">{action.assigneeName ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Deadline</dt>
                <dd className={cn("font-medium", overdue ? "text-destructive" : "text-foreground")}>
                  {action.dueDate ? formatDate(action.dueDate) : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd><Badge tone={action.status === "COMPLETED" ? "success" : "info"}>{titleCase(action.status)}</Badge></dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No open tasks</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Sidebar — Student summary
// ─────────────────────────────────────────────

function SidebarStudentSummary({ app }: { app: ApplicationDetail }) {
  const student = app.student;
  return (
    <Card>
      <CardHeader><CardTitle>Student Summary</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          {student.avatar ? (
            <img src={student.avatar} alt={`${student.firstName} ${student.lastName}`} className="h-12 w-12 rounded-full object-cover ring-2 ring-border" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {initials(`${student.firstName} ${student.lastName}`) || "S"}
            </span>
          )}
          <div className="min-w-0">
            <Link href={`/employee/students/${student.id}`} className="font-medium hover:underline">
              {student.firstName} {student.lastName}
            </Link>
            <p className="text-xs text-muted-foreground">{student.studentId}</p>
          </div>
        </div>
        <Separator className="my-3" />
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Current stage</dt>
            <dd><Badge tone="info">{titleCase(app.stageKey)}</Badge></dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Priority</dt>
            <dd><Badge tone={app.priority === "URGENT" || app.priority === "HIGH" ? "destructive" : "warning"}>{app.priority}</Badge></dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Deadline</dt>
            <dd className={cn("font-medium", app.deadline && app.deadline < new Date() ? "text-destructive" : "text-foreground")}>
              {app.deadline ? formatDate(app.deadline) : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Assigned to</dt>
            <dd className="font-medium">{app.assignedEmployee?.user.name ?? "—"}</dd>
          </div>
          {student.country && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Country</dt>
              <dd className="flex items-center gap-1 font-medium"><MapPin className="h-3 w-3" />{student.country}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Sidebar — Quick actions (permission-aware)
// ─────────────────────────────────────────────

function SidebarQuickActions({
  app,
  perms,
}: {
  app: ApplicationDetail;
  perms: {
    edit: boolean;
    createTask: boolean;
    reviewDocs: boolean;
    message: boolean;
  };
}) {
  const actions: { label: string; href: string; icon: typeof Plus; show: boolean }[] = [
    { label: "Change stage", href: `#stage`, icon: FolderKanban, show: perms.edit },
    { label: "Create task", href: `/employee/tasks?studentId=${app.student.id}&applicationId=${app.id}&new=true`, icon: CheckSquare, show: perms.createTask },
    { label: "Request document", href: `/employee/documents?studentId=${app.student.id}&applicationId=${app.id}&request=true`, icon: FileUp, show: perms.reviewDocs },
    { label: "Send message", href: `/employee/messages?studentId=${app.student.id}`, icon: Mail, show: perms.message },
    { label: "Schedule appointment", href: `/employee/appointments?studentId=${app.student.id}&new=true`, icon: CalendarPlus, show: perms.createTask },
  ];
  const visible = actions.filter((a) => a.show);
  if (visible.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {visible.map((a) =>
          a.href.startsWith("#") ? (
            <a key={a.label} href={a.href} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted">
              <a.icon className="h-4 w-4" aria-hidden /> {a.label}
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </a>
          ) : (
            <Link key={a.label} href={a.href} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted">
              <a.icon className="h-4 w-4" aria-hidden /> {a.label}
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </Link>
          ),
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Overview — 9 sections
// ─────────────────────────────────────────────

function OverviewTab({ app }: { app: ApplicationDetail }) {
  return (
    <div className="space-y-4">
      {/* Student */}
      <SectionCard title="Student" icon={<UserRound className="h-4 w-4" />}>
        <Field label="Name" value={`${app.student.firstName} ${app.student.lastName}`} />
        <Field label="Student ID" value={app.student.studentId} />
        <Field label="Email" value={app.student.email} />
        <Field label="Phone" value={app.student.phone ?? "—"} />
        <Field label="Nationality" value={app.student.nationality ?? "—"} />
        <Field label="Country" value={app.student.country ?? "—"} />
      </SectionCard>

      {/* Academic Profile */}
      <SectionCard title="Academic Profile" icon={<GraduationCap className="h-4 w-4" />}>
        {app.student.academicRecords.length === 0 ? (
          <p className="col-span-2 text-sm text-muted-foreground">No academic records</p>
        ) : (
          <div className="col-span-2 space-y-2">
            {app.student.academicRecords.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-2 text-xs">
                <p className="font-medium">{r.level} · {r.institution}</p>
                <p className="text-muted-foreground">{[r.passingYear, r.result].filter(Boolean).join(" · ")}</p>
              </div>
            ))}
          </div>
        )}
        {app.student.englishProficiencies.length > 0 && (
          <div className="col-span-2 mt-2 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">English proficiency</p>
            {app.student.englishProficiencies.map((e) => (
              <div key={e.id} className="rounded-md border border-border p-2 text-xs">
                <p className="font-medium">{e.testType} · overall {e.overallScore ?? "—"}</p>
                <p className="text-muted-foreground">{e.testDate ? formatDate(e.testDate) : "—"}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* University */}
      <SectionCard title="University" icon={<Building2 className="h-4 w-4" />}>
        <Field label="Name" value={app.university?.name ?? "—"} />
        <Field label="City" value={app.university?.city ?? "—"} />
        <Field label="Website" value={app.university?.website ?? "—"} />
      </SectionCard>

      {/* Course */}
      <SectionCard title="Course" icon={<BookOpen className="h-4 w-4" />}>
        <Field label="Name" value={app.course?.name ?? "—"} />
        <Field label="Level" value={app.course?.degreeLevel ?? "—"} />
        <Field label="Duration" value={app.course?.duration ?? "—"} />
        <Field label="Tuition" value={app.course?.tuitionFee != null ? formatMoney(app.course.tuitionFee, app.course.currency) : "—"} />
      </SectionCard>

      {/* Intake */}
      <SectionCard title="Intake" icon={<CalendarPlus className="h-4 w-4" />}>
        <Field label="Name" value={app.intake?.name ?? "—"} />
        <Field label="Month / Year" value={app.intake ? `${app.intake.month}/${app.intake.year}` : "—"} />
        <Field label="Intake deadline" value={app.intake?.deadline ? formatDate(app.intake.deadline) : "—"} />
      </SectionCard>

      {/* Application Status */}
      <SectionCard title="Application Status">
        <Field label="Stage" value={<Badge tone="info">{titleCase(app.stageKey)}</Badge>} />
        <Field label="Status" value={<Badge tone={app.status === "COMPLETED" ? "success" : "default"}>{titleCase(app.status)}</Badge>} />
        <Field label="Priority" value={<Badge tone={app.priority === "URGENT" ? "destructive" : "warning"}>{app.priority}</Badge>} />
        <Field label="Created" value={formatDate(app.createdAt)} />
        <Field label="Last update" value={formatDate(app.updatedAt)} />
        {app.archivedAt && <Field label="Archived" value={formatDate(app.archivedAt)} />}
      </SectionCard>

      {/* Visa Status */}
      <SectionCard title="Visa Status" icon={<Stamp className="h-4 w-4" />}>
        {app.visaApplications.length === 0 ? (
          <p className="col-span-2 text-sm text-muted-foreground">No visa applications</p>
        ) : (
          <div className="col-span-2 space-y-2">
            {app.visaApplications.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                <div>
                  <p className="font-medium">{v.visaType ?? "Visa application"}</p>
                  <p className="text-muted-foreground">
                    Submitted {v.submittedAt ? formatDate(v.submittedAt) : "—"}
                    {v.decisionAt ? ` · Decision ${formatDate(v.decisionAt)}` : ""}
                  </p>
                </div>
                <Badge tone={v.stage === "APPROVED" ? "success" : v.stage === "REFUSED" ? "destructive" : "info"}>{titleCase(v.stage)}</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Important Dates */}
      <SectionCard title="Important Dates" icon={<Clock className="h-4 w-4" />}>
        <Field label="Application deadline" value={app.deadline ? formatDate(app.deadline) : "—"} />
        <Field label="Intake deadline" value={app.intake?.deadline ? formatDate(app.intake.deadline) : "—"} />
        <Field label="Created" value={formatDate(app.createdAt)} />
        <Field label="Last update" value={formatDate(app.updatedAt)} />
      </SectionCard>

      {/* Assigned Employee */}
      <SectionCard title="Assigned Employee" icon={<UserRound className="h-4 w-4" />}>
        <Field label="Name" value={app.assignedEmployee?.user.name ?? "—"} />
        <Field label="Email" value={app.assignedEmployee?.user.email ?? "—"} />
        <Field label="Title" value={app.assignedEmployee?.title ?? "—"} />
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Timeline — ApplicationStatusHistory with permission-aware note visibility
// ─────────────────────────────────────────────

function TimelineTab({ app, canSeeInternal }: { app: ApplicationDetail; canSeeInternal: boolean }) {
  if (app.stageHistory.length === 0) {
    return <EmptyCard label="No stage history yet" />;
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Timeline ({app.stageHistory.length})</CardTitle>
        {!canSeeInternal && <Badge tone="default">Internal notes hidden</Badge>}
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border pl-4">
          {app.stageHistory.map((h) => {
            // Notes are visible only to callers with audit.read.
            // Employees without audit.read see the transition but not the note.
            const showNote = canSeeInternal && h.note;
            return (
              <li key={h.id} className="relative">
                <span aria-hidden className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <p className="text-sm font-medium">
                  {h.fromStage ? titleCase(h.fromStage) : "—"} → {titleCase(h.toStage)}
                </p>
                <p className="text-xs text-muted-foreground">
                  By {h.changedByName} · {formatDate(h.createdAt)}
                </p>
                {showNote && <p className="mt-1 text-xs italic text-muted-foreground">"{h.note}"</p>}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Other tabs (Documents / Tasks / Payments / Visa / Messages / Notes)
// ─────────────────────────────────────────────

function DocumentsTab({ app, perms }: { app: ApplicationDetail; perms: { reviewDocs: boolean } }) {
  if (app.documents.length === 0) return <EmptyCard label="No documents" action={perms.reviewDocs ? `/employee/documents?studentId=${app.student.id}&applicationId=${app.id}&request=true` : undefined} />;
  const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
    REQUESTED: "warning", UPLOADED: "info", UNDER_REVIEW: "info", APPROVED: "success", REJECTED: "destructive",
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents ({app.documents.length})</CardTitle>
        {perms.reviewDocs && (
          <Link href={`/employee/documents?studentId=${app.student.id}&applicationId=${app.id}&request=true`}>
            <Button variant="outline" size="sm"><FileUp className="h-3.5 w-3.5" aria-hidden /> Request</Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {app.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">Uploaded {d.uploadedAt ? formatDate(d.uploadedAt) : "—"}</p>
              </div>
              <Badge tone={STATUS_TONE[d.status] ?? "default"}>{titleCase(d.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TasksTab({ app, perms }: { app: ApplicationDetail; perms: { createTask: boolean } }) {
  if (app.tasks.length === 0) return <EmptyCard label="No tasks" action={perms.createTask ? `/employee/tasks?studentId=${app.student.id}&applicationId=${app.id}&new=true` : undefined} />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tasks ({app.tasks.length})</CardTitle>
        {perms.createTask && (
          <Link href={`/employee/tasks?studentId=${app.student.id}&applicationId=${app.id}&new=true`}>
            <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Add Task</Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {app.tasks.map((t) => {
            const overdue = t.dueDate && t.dueDate < new Date() && t.status !== "COMPLETED";
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date"} · {titleCase(t.priority)}
                  </p>
                </div>
                <Badge tone={t.status === "COMPLETED" ? "success" : overdue ? "destructive" : "info"}>{titleCase(t.status)}</Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function PaymentsTab({ app }: { app: ApplicationDetail }) {
  if (app.payments.length === 0) return <EmptyCard label="No payments" />;
  const total = app.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payments ({app.payments.length})</CardTitle>
        <Badge tone="success">Paid: {formatMoney(total, app.payments[0]?.currency ?? "EUR")}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {app.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-4">
              <div><p className="font-medium">{formatMoney(p.amount, p.currency)}</p><p className="text-xs text-muted-foreground">{formatDate(p.paymentDate)}</p></div>
              <Badge tone={p.status === "PAID" ? "success" : "default"}>{titleCase(p.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function VisaTab({ app }: { app: ApplicationDetail }) {
  if (app.visaApplications.length === 0) return <EmptyCard label="No visa applications" />;
  return (
    <Card>
      <CardHeader><CardTitle>Visa Applications ({app.visaApplications.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {app.visaApplications.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{v.visaType ?? "Visa application"}</p>
                <p className="text-xs text-muted-foreground">
                  Submitted {v.submittedAt ? formatDate(v.submittedAt) : "—"}{v.decisionAt ? ` · Decision ${formatDate(v.decisionAt)}` : ""}
                </p>
              </div>
              <Badge tone={v.stage === "APPROVED" ? "success" : v.stage === "REFUSED" ? "destructive" : "info"}>{titleCase(v.stage)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MessagesTab({ app, perms }: { app: ApplicationDetail; perms: { message: boolean } }) {
  if (app.conversations.length === 0) return <EmptyCard label="No conversations" action={perms.message ? `/employee/messages?studentId=${app.student.id}` : undefined} />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Conversations ({app.conversations.length})</CardTitle>
        {perms.message && (
          <Link href={`/employee/messages?studentId=${app.student.id}`}>
            <Button variant="outline" size="sm"><Mail className="h-3.5 w-3.5" aria-hidden /> Send</Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {app.conversations.map((c) => (
            <li key={c.id} className="p-4">
              <p className="font-medium">{c.subject ?? "No subject"}</p>
              <p className="text-xs text-muted-foreground">{c.messages.length} message{c.messages.length === 1 ? "" : "s"} · {formatDate(c.updatedAt)}</p>
              {c.messages[0] && <p className="mt-1 truncate text-xs text-muted-foreground">Latest: {c.messages[0].body.slice(0, 80)}</p>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function NotesTab({ app }: { app: ApplicationDetail }) {
  if (!app.notes) return <EmptyCard label="No notes on this application" />;
  return (
    <Card>
      <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
      <CardContent><p className="text-sm whitespace-pre-wrap">{app.notes}</p></CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function UnauthorizedTab() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <p className="text-sm font-medium">You don&apos;t have permission to view this section.</p>
        <p className="mt-1 text-xs text-muted-foreground">Contact your administrator if you believe this is an error.</p>
      </CardContent>
    </Card>
  );
}

function EmptyCard({ label, action }: { label: string; action?: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <p className="text-sm font-medium">{label}</p>
        {action && (
          <Link href={action} className="mt-3 inline-block">
            <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Create</Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}{title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          {children}
        </dl>
      </CardContent>
    </Card>
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
