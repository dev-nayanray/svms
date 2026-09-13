import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FolderKanban, FileText, CheckSquare, CreditCard, Receipt,
  Stamp, Clock, StickyNote, Pencil, Mail, Plus,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Separator } from "@/components/ui";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, formatMoney, titleCase, cn } from "@/lib/utils";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";
import { requireApplication, type ApplicationDetail } from "@/lib/services/application-cases";
import { StageChanger } from "@/components/employee/stage-changer";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "overview", label: "Overview", icon: FolderKanban },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "tasks", label: "Tasks", icon: CheckSquare },
  { value: "payments", label: "Payments", icon: CreditCard },
  { value: "invoices", label: "Invoices", icon: Receipt },
  { value: "visa", label: "Visa", icon: Stamp },
  { value: "history", label: "Stage History", icon: Clock },
  { value: "notes", label: "Notes", icon: StickyNote },
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
    viewPayments: hasPermission(role, "payments.read"),
    viewInvoices: hasPermission(role, "invoices.read"),
    viewTasks: hasPermission(role, "tasks.read"),
    viewMessages: hasPermission(role, "messages.read"),
    createTask: hasPermission(role, "tasks.manage"),
    message: hasPermission(role, "messages.create"),
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

      <EmployeePageHeader
        title={app.applicationNumber}
        description={`${app.student.firstName} ${app.student.lastName} · ${app.country?.name ?? "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{titleCase(app.stageKey)}</Badge>
            <Badge tone={app.status === "COMPLETED" ? "success" : app.status === "CANCELLED" ? "destructive" : "default"}>{titleCase(app.status)}</Badge>
            <Badge tone={app.priority === "URGENT" || app.priority === "HIGH" ? "destructive" : app.priority === "MEDIUM" ? "warning" : "default"}>{app.priority}</Badge>
            {app.archivedAt && <Badge tone="warning">Archived</Badge>}
          </div>
        }
      />

      {/* Quick actions */}
      <div className="mb-4 flex flex-wrap gap-2">
        {perms.createTask && (
          <Link href={`/employee/tasks?studentId=${app.student.id}&applicationId=${app.id}&new=true`}>
            <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Add Task</Button>
          </Link>
        )}
        {perms.edit && (
          <Link href={`/employee/students/${app.student.id}?tab=notes`}>
            <Button variant="outline" size="sm"><StickyNote className="h-3.5 w-3.5" aria-hidden /> Add Note</Button>
          </Link>
        )}
        {perms.message && (
          <Link href={`/employee/messages?studentId=${app.student.id}`}>
            <Button variant="outline" size="sm"><Mail className="h-3.5 w-3.5" aria-hidden /> Message</Button>
          </Link>
        )}
        <Link href={`/employee/students/${app.student.id}`}>
          <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" aria-hidden /> View Student</Button>
        </Link>
      </div>

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
            <TabsContent value="documents">
              {perms.viewDocs ? <DocumentsTab app={app} /> : <UnauthorizedTab />}
            </TabsContent>
            <TabsContent value="tasks">
              {perms.viewTasks ? <TasksTab app={app} perms={perms} /> : <UnauthorizedTab />}
            </TabsContent>
            <TabsContent value="payments">
              {perms.viewPayments ? <PaymentsTab app={app} /> : <UnauthorizedTab />}
            </TabsContent>
            <TabsContent value="invoices">
              {perms.viewInvoices ? <InvoicesTab app={app} /> : <UnauthorizedTab />}
            </TabsContent>
            <TabsContent value="visa">
              <VisaTab app={app} />
            </TabsContent>
            <TabsContent value="history">
              <HistoryTab app={app} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesTab app={app} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Side column — stage changer + assignee */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Stage</CardTitle></CardHeader>
            <CardContent>
              <StageChanger applicationId={app.id} currentStage={app.stageKey} canEdit={perms.edit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Application assignee</dt>
                  <dd className="font-medium">{app.assignedEmployee?.user.name ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Student counselor</dt>
                  <dd className="font-medium">{app.student.firstName} {app.student.lastName}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {app.deadline && (
            <Card>
              <CardHeader><CardTitle>Deadline</CardTitle></CardHeader>
              <CardContent>
                <p className={cn("text-sm font-medium", app.deadline < new Date() ? "text-destructive" : "text-foreground")}>
                  {formatDate(app.deadline)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────

function OverviewTab({ app }: { app: ApplicationDetail }) {
  return (
    <Card>
      <CardHeader><CardTitle>Application details</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Field label="Application #" value={app.applicationNumber} />
          <Field label="Student" value={`${app.student.firstName} ${app.student.lastName}`} />
          <Field label="Student ID" value={app.student.studentId} />
          <Field label="Country" value={app.country?.name ?? "—"} />
          <Field label="University" value={app.university?.name ?? "—"} />
          <Field label="Course" value={app.course?.name ?? "—"} />
          <Field label="Intake" value={app.intake?.name ?? "—"} />
          <Field label="Priority" value={app.priority} />
          <Field label="Deadline" value={app.deadline ? formatDate(app.deadline) : "—"} />
          <Field label="Created" value={formatDate(app.createdAt)} />
          <Field label="Last update" value={formatDate(app.updatedAt)} />
          <Field label="Status" value={titleCase(app.status)} />
        </dl>
        {app.notes && (
          <>
            <Separator className="my-4" />
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{app.notes}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsTab({ app }: { app: ApplicationDetail }) {
  if (app.documents.length === 0) return <EmptyCard label="No documents" />;
  const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
    REQUESTED: "warning", UPLOADED: "info", UNDER_REVIEW: "info", APPROVED: "success", REJECTED: "destructive",
  };
  return (
    <Card>
      <CardHeader><CardTitle>Documents ({app.documents.length})</CardTitle></CardHeader>
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
  return (
    <Card>
      <CardHeader><CardTitle>Payments ({app.payments.length})</CardTitle></CardHeader>
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

function InvoicesTab({ app }: { app: ApplicationDetail }) {
  if (app.invoices.length === 0) return <EmptyCard label="No invoices" />;
  return (
    <Card>
      <CardHeader><CardTitle>Invoices ({app.invoices.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {app.invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 p-4">
              <div><p className="font-mono text-sm font-medium">{inv.invoiceNumber}</p><p className="text-xs text-muted-foreground">{formatMoney(inv.amount, inv.currency)}</p></div>
              <Badge tone={inv.status === "PAID" ? "success" : inv.status === "OVERDUE" ? "destructive" : "info"}>{titleCase(inv.status)}</Badge>
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

function HistoryTab({ app }: { app: ApplicationDetail }) {
  if (app.stageHistory.length === 0) return <EmptyCard label="No stage history yet" />;
  return (
    <Card>
      <CardHeader><CardTitle>Stage History ({app.stageHistory.length})</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border pl-4">
          {app.stageHistory.map((h) => (
            <li key={h.id} className="relative">
              <span aria-hidden className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
              <p className="text-sm font-medium">{titleCase(h.fromStage ?? "—")} → {titleCase(h.toStage)}</p>
              {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground/70">{formatDate(h.createdAt)}</p>
            </li>
          ))}
        </ol>
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
