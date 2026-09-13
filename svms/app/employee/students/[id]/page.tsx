import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, UserRound, GraduationCap, Languages, Stamp, FolderKanban,
  FileText, CreditCard, Receipt, CheckSquare, MessageSquare, Clock,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, formatMoney, titleCase, cn } from "@/lib/utils";
import { requireStudent, buildStudentTimeline, type StudentDetail } from "@/lib/services/student-cases";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "academic", label: "Academic", icon: GraduationCap },
  { value: "english", label: "English", icon: Languages },
  { value: "passport", label: "Passport", icon: Stamp },
  { value: "applications", label: "Applications", icon: FolderKanban },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "payments", label: "Payments", icon: CreditCard },
  { value: "invoices", label: "Invoices", icon: Receipt },
  { value: "tasks", label: "Tasks", icon: CheckSquare },
  { value: "messages", label: "Messages", icon: MessageSquare },
  { value: "timeline", label: "Timeline", icon: Clock },
] as const;

export default async function EmployeeStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/students");
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
    viewApps: hasPermission(role, "applications.read"),
    viewDocs: hasPermission(role, "documents.read"),
    viewPayments: hasPermission(role, "payments.read"),
    viewInvoices: hasPermission(role, "invoices.read"),
    viewTasks: hasPermission(role, "tasks.read"),
    viewMessages: hasPermission(role, "messages.read"),
    edit: hasPermission(role, "students.update"),
  };

  const { id } = await params;
  let student: StudentDetail;
  try {
    student = await requireStudent(scope, id);
  } catch {
    // 404 — IDOR closure: foreign student looks the same as missing.
    notFound();
  }

  const sp = await searchParams;
  const activeTab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "profile";

  return (
    <div>
      <Link href="/employee/students" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" aria-hidden /> Back to My Students
      </Link>

      <EmployeePageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={`${student.studentId} · ${student.email}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="info">{titleCase(student.status)}</Badge>
            {student.assignedEmployee && (
              <span className="text-xs text-muted-foreground">
                Counselor: {student.assignedEmployee.user.name}
              </span>
            )}
          </div>
        }
      />

      <Tabs tabs={TABS.map((t) => ({ value: t.value, label: t.label }))} defaultValue={activeTab}>
        <div className="mt-4">
          <TabsContent value="profile">
            <ProfileTab student={student} />
          </TabsContent>
          <TabsContent value="academic">
            <AcademicTab />
          </TabsContent>
          <TabsContent value="english">
            <EnglishTab />
          </TabsContent>
          <TabsContent value="passport">
            <PassportTab student={student} />
          </TabsContent>
          <TabsContent value="applications">
            {perms.viewApps ? <ApplicationsTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="documents">
            {perms.viewDocs ? <DocumentsTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="payments">
            {perms.viewPayments ? <PaymentsTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="invoices">
            {perms.viewInvoices ? <InvoicesTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="tasks">
            {perms.viewTasks ? <TasksTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="messages">
            {perms.viewMessages ? <MessagesTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab student={student} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Profile
// ─────────────────────────────────────────────

function ProfileTab({ student }: { student: StudentDetail }) {
  return (
    <Card>
      <CardHeader><CardTitle>Student information</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Field label="First name" value={student.firstName} />
          <Field label="Last name" value={student.lastName} />
          <Field label="Student ID" value={student.studentId} />
          <Field label="Email" value={student.email} />
          <Field label="Phone" value={student.phone ?? "—"} />
          <Field label="Date of birth" value={student.dateOfBirth ? formatDate(student.dateOfBirth) : "—"} />
          <Field label="Gender" value={student.gender ? titleCase(student.gender) : "—"} />
          <Field label="Nationality" value={student.nationality ?? "—"} />
          <Field label="Country" value={student.country ?? "—"} />
          <Field label="City" value={student.city ?? "—"} />
          <Field label="Status" value={<Badge tone="info">{titleCase(student.status)}</Badge>} />
          <Field label="Created" value={formatDate(student.createdAt)} />
        </dl>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Academic
// ─────────────────────────────────────────────

function AcademicTab() {
  return (
    <Card>
      <CardHeader><CardTitle>Academic records</CardTitle></CardHeader>
      <CardContent>
        <EmptyState label="Academic records are managed by the student profile module." hint="A dedicated AcademicRecord model will ship in a future release." />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: English
// ─────────────────────────────────────────────

function EnglishTab() {
  return (
    <Card>
      <CardHeader><CardTitle>English proficiency</CardTitle></CardHeader>
      <CardContent>
        <EmptyState label="English proficiency records are managed by the student profile module." hint="A dedicated EnglishProficiency model will ship in a future release." />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Passport
// ─────────────────────────────────────────────

function PassportTab({ student }: { student: StudentDetail }) {
  // The current Student model has no passport fields; the previous SVMS
  // project's schema did but the Euroscope rebuild hasn't added them yet.
  // We surface a placeholder so the tab is reachable.
  return (
    <Card>
      <CardHeader><CardTitle>Passport information</CardTitle></CardHeader>
      <CardContent>
        <EmptyState label="Passport details will appear here once the field set is added." hint="Nationality is the only related field currently on the Student record: " />
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <Field label="Nationality" value={student.nationality ?? "—"} />
          <Field label="Country" value={student.country ?? "—"} />
        </dl>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Applications
// ─────────────────────────────────────────────

function ApplicationsTab({ student }: { student: StudentDetail }) {
  if (student.applications.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Applications</CardTitle></CardHeader>
        <CardContent><EmptyState label="No applications yet" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Applications ({student.applications.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {student.applications.map((app) => (
            <li key={app.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={`/employee/applications/${app.id}`} className="font-medium hover:underline">
                  {app.applicationNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {app.country?.name ?? "—"}{app.university ? ` · ${app.university.name}` : ""}{app.course ? ` · ${app.course.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="info">{titleCase(app.stageKey)}</Badge>
                <Badge tone={app.status === "COMPLETED" ? "success" : "default"}>{titleCase(app.status)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Documents
// ─────────────────────────────────────────────

function DocumentsTab({ student }: { student: StudentDetail }) {
  if (student.documents.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent><EmptyState label="No documents uploaded yet" /></CardContent>
      </Card>
    );
  }
  const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
    REQUESTED: "warning",
    UPLOADED: "info",
    UNDER_REVIEW: "info",
    APPROVED: "success",
    REJECTED: "destructive",
  };
  return (
    <Card>
      <CardHeader><CardTitle>Documents ({student.documents.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {student.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  Uploaded {d.uploadedAt ? formatDate(d.uploadedAt) : "—"} · {d.fileName ?? "—"}
                </p>
                {d.reviewNote && <p className="mt-1 text-xs text-muted-foreground">Note: {d.reviewNote}</p>}
              </div>
              <Badge tone={STATUS_TONE[d.status] ?? "default"}>{titleCase(d.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Payments
// ─────────────────────────────────────────────

function PaymentsTab({ student }: { student: StudentDetail }) {
  if (student.payments.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardContent><EmptyState label="No payments recorded" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Payments ({student.payments.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {student.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">{formatMoney(p.amount, p.currency)}</p>
                <p className="text-xs text-muted-foreground">{titleCase(p.paymentMethod)} · {formatDate(p.paymentDate ?? p.createdAt)}</p>
              </div>
              <Badge tone={p.status === "PAID" ? "success" : p.status === "REFUNDED" ? "warning" : "default"}>{titleCase(p.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Invoices
// ─────────────────────────────────────────────

function InvoicesTab({ student }: { student: StudentDetail }) {
  if (student.invoices.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent><EmptyState label="No invoices issued" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Invoices ({student.invoices.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {student.invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium font-mono text-sm">{inv.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(inv.amount, inv.currency)} · Issued {formatDate(inv.issueDate)}{inv.dueDate ? ` · Due ${formatDate(inv.dueDate)}` : ""}
                </p>
              </div>
              <Badge tone={inv.status === "PAID" ? "success" : inv.status === "OVERDUE" ? "destructive" : "info"}>{titleCase(inv.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Tasks
// ─────────────────────────────────────────────

function TasksTab({ student }: { student: StudentDetail }) {
  if (student.tasks.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
        <CardContent><EmptyState label="No tasks" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Tasks ({student.tasks.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {student.tasks.map((t) => {
            const overdue = t.dueDate && t.dueDate < new Date() && t.status !== "COMPLETED";
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date"} · {titleCase(t.priority)}
                  </p>
                </div>
                <Badge tone={t.status === "COMPLETED" ? "success" : t.status === "CANCELLED" ? "destructive" : overdue ? "destructive" : "info"}>
                  {titleCase(t.status)}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Messages
// ─────────────────────────────────────────────

function MessagesTab({ student }: { student: StudentDetail }) {
  if (student.conversations.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Messages</CardTitle></CardHeader>
        <CardContent><EmptyState label="No conversations yet" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Conversations ({student.conversations.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {student.conversations.map((c) => (
            <li key={c.id} className="p-4">
              <p className="font-medium">{c.subject ?? "No subject"}</p>
              <p className="text-xs text-muted-foreground">Updated {formatDate(c.updatedAt)} · {c.messages.length} message{c.messages.length === 1 ? "" : "s"}</p>
              {c.messages[0] && (
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  Latest: {c.messages[0].body.slice(0, 80)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Timeline — merged activity feed
// ─────────────────────────────────────────────

function TimelineTab({ student }: { student: StudentDetail }) {
  const items = buildStudentTimeline(student);
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent><EmptyState label="No activity yet" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Timeline ({items.length})</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border pl-4">
          {items.map((item, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[1.4rem] top-1 grid h-3 w-3 place-items-center rounded-full border-2 border-background",
                  item.kind.startsWith("application") ? "bg-primary"
                    : item.kind.startsWith("document") ? "bg-warning"
                    : item.kind.startsWith("visa") ? "bg-info"
                    : item.kind.startsWith("payment") || item.kind.startsWith("invoice") ? "bg-success"
                    : item.kind.startsWith("task") ? "bg-success"
                    : "bg-muted-foreground",
                )}
              />
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">{formatDate(item.at)}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Unauthorized / empty states
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

function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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
