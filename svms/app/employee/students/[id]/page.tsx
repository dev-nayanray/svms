import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, UserRound, GraduationCap, Languages, Stamp, FolderKanban,
  FileText, CreditCard, Receipt, CheckSquare, MessageSquare, Clock,
  StickyNote, Pencil, Plus, CheckSquare as TaskIcon, CalendarPlus, Mail,
  EyeOff, MapPin, Mail as MailIcon, Phone, Calendar,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Separator } from "@/components/ui";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, formatMoney, titleCase, cn, initials } from "@/lib/utils";
import {
  requireStudent,
  buildStudentTimelineForUser,
  type StudentDetail,
} from "@/lib/services/student-cases";
import { AddNoteForm } from "@/components/employee/add-note-form";

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
  { value: "notes", label: "Notes", icon: StickyNote },
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
    createTask: hasPermission(role, "tasks.manage"),
    message: hasPermission(role, "messages.create"),
    reviewDocs: hasPermission(role, "documents.review"),
    seeInternal: hasPermission(role, "audit.read"),
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

  // Derive header metadata from the primary (most-recent) application.
  const primaryApp = student.applications[0] ?? null;
  const primaryVisa = student.visaApplications[0] ?? null;
  const nextDeadline = computeNextDeadline(student);

  return (
    <div>
      <Link href="/employee/students" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" aria-hidden /> Back to My Students
      </Link>

      <StudentHeader
        student={student}
        primaryApp={primaryApp}
        primaryVisaStage={primaryVisa?.stage ?? null}
        nextDeadline={nextDeadline}
        perms={perms}
      />

      <Tabs tabs={TABS.map((t) => ({ value: t.value, label: t.label }))} defaultValue={activeTab}>
        <div className="mt-4">
          <TabsContent value="profile">
            <ProfileTab student={student} perms={perms} />
          </TabsContent>
          <TabsContent value="academic">
            <AcademicTab student={student} />
          </TabsContent>
          <TabsContent value="english">
            <EnglishTab student={student} />
          </TabsContent>
          <TabsContent value="passport">
            <PassportTab student={student} perms={perms} />
          </TabsContent>
          <TabsContent value="applications">
            {perms.viewApps ? <ApplicationsTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="documents">
            {perms.viewDocs ? <DocumentsTab student={student} perms={perms} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="payments">
            {perms.viewPayments ? <PaymentsTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="invoices">
            {perms.viewInvoices ? <InvoicesTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="tasks">
            {perms.viewTasks ? <TasksTab student={student} perms={perms} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="messages">
            {perms.viewMessages ? <MessagesTab student={student} perms={perms} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="notes">
            {perms.edit ? <NotesTab student={student} /> : <UnauthorizedTab />}
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab student={student} canSeeInternal={perms.seeInternal} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────

function StudentHeader({
  student,
  primaryApp,
  primaryVisaStage,
  nextDeadline,
  perms,
}: {
  student: StudentDetail;
  primaryApp: StudentDetail["applications"][number] | null;
  primaryVisaStage: string | null;
  nextDeadline: Date | null;
  perms: {
    edit: boolean;
    createTask: boolean;
    message: boolean;
    viewApps: boolean;
    reviewDocs: boolean;
  };
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          {/* Left: avatar + name + IDs */}
          <div className="flex items-start gap-4">
            <Avatar student={student} />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">
                {student.firstName} {student.lastName}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {student.studentId}
                {primaryApp && <span> · {primaryApp.applicationNumber}</span>}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={student.status === "ACTIVE" ? "success" : student.status === "SUSPENDED" ? "destructive" : "warning"}>
                  {titleCase(student.status)}
                </Badge>
                {primaryApp && (
                  <>
                    <Badge tone="info">{titleCase(primaryApp.stageKey)}</Badge>
                    <Badge tone={primaryApp.status === "COMPLETED" ? "success" : "default"}>{titleCase(primaryApp.status)}</Badge>
                  </>
                )}
                {primaryVisaStage && (
                  <Badge tone={primaryVisaStage === "APPROVED" ? "success" : primaryVisaStage === "REFUSED" ? "destructive" : "info"}>
                    Visa: {titleCase(primaryVisaStage)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right: metadata grid + quick actions */}
          <div className="flex flex-col gap-3 md:items-end">
            <MetadataGrid
              student={student}
              primaryApp={primaryApp}
              nextDeadline={nextDeadline}
            />
            <QuickActions studentId={student.id} perms={perms} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Avatar({ student }: { student: StudentDetail }) {
  if (student.avatar) {
    return (
      <img
        src={student.avatar}
        alt={`${student.firstName} ${student.lastName}`}
        className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
      />
    );
  }
  return (
    <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-lg font-bold text-primary">
      {initials(`${student.firstName} ${student.lastName}`) || "S"}
    </span>
  );
}

function MetadataGrid({
  student,
  primaryApp,
  nextDeadline,
}: {
  student: StudentDetail;
  primaryApp: StudentDetail["applications"][number] | null;
  nextDeadline: Date | null;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:text-right">
      {student.assignedEmployee && (
        <MetaItem label="Counselor" value={student.assignedEmployee.user.name} />
      )}
      {student.country && <MetaItem label="Country" value={student.country} />}
      {primaryApp?.university && (
        <MetaItem label="University" value={primaryApp.university.name} />
      )}
      {nextDeadline && (
        <MetaItem
          label="Next deadline"
          value={formatDate(nextDeadline)}
          tone={nextDeadline < new Date() ? "destructive" : undefined}
        />
      )}
    </dl>
  );
}

function MetaItem({ label, value, tone }: { label: string; value: string; tone?: "destructive" }) {
  return (
    <div className="md:text-right">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", tone === "destructive" && "text-destructive")}>{value}</dd>
    </div>
  );
}

function QuickActions({
  studentId,
  perms,
}: {
  studentId: string;
  perms: {
    edit: boolean;
    createTask: boolean;
    message: boolean;
    viewApps: boolean;
    reviewDocs: boolean;
  };
}) {
  const actions: { label: string; href: string; icon: typeof Pencil; show: boolean }[] = [
    { label: "Edit", href: `/employee/students/${studentId}?tab=profile`, icon: Pencil, show: perms.edit },
    { label: "Add Task", href: `/employee/tasks?studentId=${studentId}&new=true`, icon: TaskIcon, show: perms.createTask },
    { label: "Add Note", href: `/employee/students/${studentId}?tab=notes`, icon: StickyNote, show: perms.edit },
    { label: "Message", href: `/employee/messages?studentId=${studentId}`, icon: Mail, show: perms.message },
    { label: "Request Doc", href: `/employee/documents?studentId=${studentId}&request=true`, icon: FileText, show: perms.reviewDocs },
    { label: "Appointment", href: `/employee/appointments?studentId=${studentId}&new=true`, icon: CalendarPlus, show: perms.createTask },
    { label: "View App", href: primaryAppHref(studentId, perms), icon: FolderKanban, show: perms.viewApps },
  ];
  const visible = actions.filter((a) => a.show);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((a) => (
        <Link key={a.label} href={a.href}>
          <Button variant="outline" size="sm">
            <a.icon className="h-3.5 w-3.5" aria-hidden /> {a.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}

function primaryAppHref(studentId: string, perms: { viewApps: boolean }): string {
  // We don't have the primary app id at this level — link to the filtered list.
  return perms.viewApps ? `/employee/applications?studentId=${studentId}` : `/employee/students/${studentId}`;
}

function computeNextDeadline(student: StudentDetail): Date | null {
  const candidates: Date[] = [];
  for (const t of student.tasks) {
    if (t.dueDate && t.status !== "COMPLETED" && t.status !== "CANCELLED") candidates.push(t.dueDate);
  }
  for (const v of student.visaApplications) {
    if (v.biometricsAt) candidates.push(v.biometricsAt);
    if (v.interviewAt) candidates.push(v.interviewAt);
  }
  for (const ap of student.appointments) {
    if (ap.status === "SCHEDULED") candidates.push(ap.scheduledAt);
  }
  if (candidates.length === 0) return null;
  const future = candidates.filter((d) => d > new Date());
  return future.length > 0 ? future.sort((a, b) => a.getTime() - b.getTime())[0] : candidates.sort((a, b) => a.getTime() - b.getTime())[0];
}

// ─────────────────────────────────────────────
// Tab: Profile
// ─────────────────────────────────────────────

function ProfileTab({ student, perms }: { student: StudentDetail; perms: { edit: boolean } }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Personal & contact information</CardTitle>
        {perms.edit && (
          <Link href={`/employee/students/${student.id}?tab=profile&edit=true`}>
            <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Field label="First name" value={student.firstName} />
          <Field label="Last name" value={student.lastName} />
          <Field label="Student ID" value={student.studentId} />
          <Field label="Email" value={student.email} icon={<MailIcon className="h-3.5 w-3.5" aria-hidden />} />
          <Field label="Phone" value={student.phone ?? "—"} icon={<Phone className="h-3.5 w-3.5" aria-hidden />} />
          <Field label="Date of birth" value={student.dateOfBirth ? formatDate(student.dateOfBirth) : "—"} icon={<Calendar className="h-3.5 w-3.5" aria-hidden />} />
          <Field label="Gender" value={student.gender ? titleCase(student.gender) : "—"} />
          <Field label="Nationality" value={student.nationality ?? "—"} />
          <Field label="Country" value={student.country ?? "—"} icon={<MapPin className="h-3.5 w-3.5" aria-hidden />} />
          <Field label="City" value={student.city ?? "—"} />
          <Field label="Address" value={student.address ?? "—"} />
          <Field label="Postal code" value={student.postalCode ?? "—"} />
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

function AcademicTab({ student }: { student: StudentDetail }) {
  if (student.academicRecords.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Academic records</CardTitle></CardHeader>
        <CardContent><EmptyState label="No academic records yet" hint="Add education history from the student profile editor." /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Academic records ({student.academicRecords.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {student.academicRecords.map((r) => (
            <li key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.level} <span className="text-xs text-muted-foreground">· {r.institution}</span></p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[r.group, r.subject, r.passingYear, r.result].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge tone="info">{r.level}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: English
// ─────────────────────────────────────────────

function EnglishTab({ student }: { student: StudentDetail }) {
  if (student.englishProficiencies.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>English proficiency</CardTitle></CardHeader>
        <CardContent><EmptyState label="No English test scores yet" hint="Add IELTS / TOEFL / PTE / Duolingo records from the student profile editor." /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>English proficiency ({student.englishProficiencies.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {student.englishProficiencies.map((e) => (
            <li key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {e.testType} <span className="text-xs text-muted-foreground">· overall {e.overallScore ?? "—"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Tested: {e.testDate ? formatDate(e.testDate) : "—"}
                    {e.expiryDate ? ` · expires ${formatDate(e.expiryDate)}` : ""}
                  </p>
                  {(e.readingScore || e.writingScore || e.listeningScore || e.speakingScore) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e.readingScore != null && <Badge tone="default">R: {e.readingScore}</Badge>}
                      {e.writingScore != null && <Badge tone="default">W: {e.writingScore}</Badge>}
                      {e.listeningScore != null && <Badge tone="default">L: {e.listeningScore}</Badge>}
                      {e.speakingScore != null && <Badge tone="default">S: {e.speakingScore}</Badge>}
                    </div>
                  )}
                </div>
                {e.expiryDate && e.expiryDate < new Date() && <Badge tone="destructive">Expired</Badge>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Passport — sensitive, masked by default
// ─────────────────────────────────────────────

function PassportTab({ student, perms }: { student: StudentDetail; perms: { edit: boolean } }) {
  const hasPassport = !!student.passportNumber || !!student.passportIssueDate || !!student.passportExpiryDate;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Passport information</CardTitle>
        <Badge tone="warning"><Stamp className="h-3 w-3" aria-hidden /> Sensitive</Badge>
      </CardHeader>
      <CardContent>
        {!hasPassport ? (
          <EmptyState label="No passport information on file" hint="Passport details are added from the student profile editor." />
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Field label="Passport number" value={student.passportNumber ? <MaskedValue value={student.passportNumber} /> : "—"} />
            <Field label="Issue date" value={student.passportIssueDate ? formatDate(student.passportIssueDate) : "—"} />
            <Field label="Expiry date" value={student.passportExpiryDate ? formatDate(student.passportExpiryDate) : "—"} />
            <Field label="Issuing country" value={student.passportIssuingCountry ?? "—"} />
            <Field label="Nationality" value={student.nationality ?? "—"} />
          </dl>
        )}
        {perms.edit && (
          <>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              Passport data is masked by default. Employees with <code className="rounded bg-muted px-1">students.update</code> permission
              can reveal the full number for verification.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MaskedValue({ value }: { value: string }) {
  // Mask all but the last 2 chars — same pattern as the existing student
  // profile module. Full reveal is intentionally not implemented here —
  // employees who need the full number should use the profile editor
  // (which is itself audit-logged).
  if (value.length <= 2) return <span>{"•".repeat(value.length)}</span>;
  return (
    <span className="font-mono">
      {"•".repeat(Math.max(0, value.length - 2))}
      <span className="text-foreground">{value.slice(-2)}</span>
    </span>
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

function DocumentsTab({ student, perms }: { student: StudentDetail; perms: { reviewDocs: boolean } }) {
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents ({student.documents.length})</CardTitle>
        {perms.reviewDocs && (
          <Link href={`/employee/documents?studentId=${student.id}&request=true`}>
            <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Request document</Button>
          </Link>
        )}
      </CardHeader>
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
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[d.status] ?? "default"}>{titleCase(d.status)}</Badge>
                {perms.reviewDocs && (
                  <Link href={`/employee/documents?studentId=${student.id}&review=${d.id}`}>
                    <Button variant="ghost" size="sm">Review</Button>
                  </Link>
                )}
              </div>
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
  const total = student.payments.reduce((s, p) => s + (p.status === "PAID" ? p.amount : 0), 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payments ({student.payments.length})</CardTitle>
        <Badge tone="success">Paid total: {formatMoney(total, student.payments[0]?.currency ?? "EUR")}</Badge>
      </CardHeader>
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

function TasksTab({ student, perms }: { student: StudentDetail; perms: { createTask: boolean } }) {
  if (student.tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tasks</CardTitle>
          {perms.createTask && (
            <Link href={`/employee/tasks?studentId=${student.id}&new=true`}>
              <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Create task</Button>
            </Link>
          )}
        </CardHeader>
        <CardContent><EmptyState label="No tasks" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tasks ({student.tasks.length})</CardTitle>
        {perms.createTask && (
          <Link href={`/employee/tasks?studentId=${student.id}&new=true`}>
            <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" aria-hidden /> Create task</Button>
          </Link>
        )}
      </CardHeader>
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

function MessagesTab({ student, perms }: { student: StudentDetail; perms: { message: boolean } }) {
  if (student.conversations.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Messages</CardTitle>
          {perms.message && (
            <Link href={`/employee/messages?studentId=${student.id}`}>
              <Button variant="outline" size="sm"><Mail className="h-3.5 w-3.5" aria-hidden /> Send message</Button>
            </Link>
          )}
        </CardHeader>
        <CardContent><EmptyState label="No conversations yet" /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Conversations ({student.conversations.length})</CardTitle>
        {perms.message && (
          <Link href={`/employee/messages?studentId=${student.id}`}>
            <Button variant="outline" size="sm"><Mail className="h-3.5 w-3.5" aria-hidden /> Send message</Button>
          </Link>
        )}
      </CardHeader>
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
// Tab: Notes
// ─────────────────────────────────────────────

function NotesTab({ student }: { student: StudentDetail }) {
  return (
    <div className="space-y-4">
      <AddNoteForm studentId={student.id} />
      <Card>
        <CardHeader><CardTitle>Notes ({student.notes.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {student.notes.length === 0 ? (
            <EmptyState label="No notes yet" hint="Use the form above to add a note. Internal notes are staff-only." />
          ) : (
            <ul className="divide-y divide-border">
              {student.notes.map((n) => (
                <li key={n.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {n.pinned && <Badge tone="info">📌 Pinned</Badge>}
                      <Badge tone={n.visibility === "INTERNAL" ? "default" : "info"}>
                        {n.visibility === "INTERNAL" ? "Internal" : "Student"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Timeline — permission-filtered
// ─────────────────────────────────────────────

function TimelineTab({ student, canSeeInternal }: { student: StudentDetail; canSeeInternal: boolean }) {
  const items = buildStudentTimelineForUser(student, canSeeInternal);
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Timeline ({items.length})</CardTitle>
        {!canSeeInternal && (
          <Badge tone="default">
            <EyeOff className="h-3 w-3" aria-hidden /> Internal events hidden
          </Badge>
        )}
      </CardHeader>
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
                    : item.kind.startsWith("note") ? "bg-accent-500"
                    : item.kind.startsWith("academic") || item.kind.startsWith("english") ? "bg-info"
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

function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {icon}{label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
