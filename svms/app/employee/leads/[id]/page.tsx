import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound, Phone, Mail, Globe, BookOpen, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Separator } from "@/components/ui";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, titleCase, cn } from "@/lib/utils";
import { requireLead, type LeadDetail, LEAD_STATUSES, LEAD_SOURCES } from "@/lib/services/lead-cases";
import { LeadActions } from "@/components/employee/lead-actions";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "notes", label: "Notes" },
  { value: "tasks", label: "Tasks" },
  { value: "appointments", label: "Appointments" },
  { value: "timeline", label: "Timeline" },
] as const;

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  NEW: "info", CONTACTED: "info", COUNSELING: "warning", QUALIFIED: "warning", CONVERTED: "success", LOST: "destructive",
};

export default async function EmployeeLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/leads");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const canManage = hasPermission(role, "leads.manage");

  const { id } = await params;
  let lead: LeadDetail;
  try {
    lead = await requireLead(scope, id);
  } catch {
    notFound();
  }

  const sp = await searchParams;
  const activeTab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "overview";

  return (
    <div>
      <Link href="/employee/leads" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Leads
      </Link>

      <EmployeePageHeader
        title={lead.name}
        description={`${lead.email ?? "No email"} · ${lead.phone ?? "No phone"}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[lead.status] ?? "default"}>{titleCase(lead.status)}</Badge>
            {lead.assignedEmployee && <span className="text-xs text-muted-foreground">{lead.assignedEmployee.name}</span>}
          </div>
        }
      />

      {/* Action bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        {canManage && lead.status !== "CONVERTED" && (
          <>
            <LeadActions leadId={lead.id} currentStatus={lead.status} canManage={canManage} canConvert={lead.status === "QUALIFIED"} />
          </>
        )}
        {lead.convertedStudentId && (
          <Link href={`/employee/students/${lead.convertedStudentId}`}>
            <Button variant="outline" size="sm"><UserRound className="h-3.5 w-3.5" aria-hidden /> View Student</Button>
          </Link>
        )}
      </div>

      <Tabs tabs={TABS.map((t) => ({ value: t.value, label: t.label }))} defaultValue={activeTab}>
        <div className="mt-4">
          <TabsContent value="overview"><OverviewTab lead={lead} /></TabsContent>
          <TabsContent value="notes"><NotesTab lead={lead} canManage={canManage} /></TabsContent>
          <TabsContent value="tasks"><TasksTab lead={lead} /></TabsContent>
          <TabsContent value="appointments"><AppointmentsTab lead={lead} /></TabsContent>
          <TabsContent value="timeline"><TimelineTab lead={lead} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function OverviewTab({ lead }: { lead: LeadDetail }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Lead information</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Field label="Name" value={lead.name} icon={<UserRound className="h-3.5 w-3.5" />} />
            <Field label="Phone" value={lead.phone ?? "—"} icon={<Phone className="h-3.5 w-3.5" />} />
            <Field label="Email" value={lead.email ?? "—"} icon={<Mail className="h-3.5 w-3.5" />} />
            <Field label="Interested country" value={lead.interestedCountry ?? "—"} icon={<Globe className="h-3.5 w-3.5" />} />
            <Field label="Preferred course" value={lead.preferredCourse ?? "—"} icon={<BookOpen className="h-3.5 w-3.5" />} />
            <Field label="Source" value={lead.source ? titleCase(lead.source.replace(/_/g, " ")) : "—"} />
            <Field label="Status" value={<Badge tone={STATUS_TONE[lead.status] ?? "default"}>{titleCase(lead.status)}</Badge>} />
            <Field label="Next follow-up" value={lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "—"} icon={<Clock className="h-3.5 w-3.5" />} />
            <Field label="Assigned to" value={lead.assignedEmployee?.name ?? "—"} />
            <Field label="Created" value={formatDate(lead.createdAt)} />
            <Field label="Last update" value={formatDate(lead.updatedAt)} />
            {lead.convertedStudentId && <Field label="Converted to student" value={<Link href={`/employee/students/${lead.convertedStudentId}`} className="text-primary hover:underline">View student</Link>} />}
          </dl>
          {lead.notes && (
            <>
              <Separator className="my-4" />
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{lead.notes}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotesTab({ lead, canManage }: { lead: LeadDetail; canManage: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>Notes ({lead.leadNotes.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        {lead.leadNotes.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No notes yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {lead.leadNotes.map((n) => (
              <li key={n.id} className="p-4">
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TasksTab({ lead }: { lead: LeadDetail }) {
  if (lead.tasks.length === 0) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No tasks — convert this lead to a student to create tasks.</CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle>Tasks ({lead.tasks.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {lead.tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-4">
              <div><p className="font-medium">{t.title}</p><p className="text-xs text-muted-foreground">{t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date"} · {titleCase(t.priority)}</p></div>
              <Badge tone={t.status === "COMPLETED" ? "success" : "info"}>{titleCase(t.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AppointmentsTab({ lead }: { lead: LeadDetail }) {
  if (lead.appointments.length === 0) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No appointments — convert this lead to a student to schedule appointments.</CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle>Appointments ({lead.appointments.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {lead.appointments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div><p className="font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{titleCase(a.type)} · {formatDate(a.scheduledAt)}</p></div>
              <Badge tone="info">{titleCase(a.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ lead }: { lead: LeadDetail }) {
  const items: { title: string; detail: string; at: Date }[] = [];
  items.push({ title: "Lead created", detail: lead.source ?? "Direct entry", at: lead.createdAt });
  if (lead.updatedAt > lead.createdAt) items.push({ title: "Last updated", detail: titleCase(lead.status), at: lead.updatedAt });
  if (lead.nextFollowUp) items.push({ title: "Follow-up scheduled", detail: formatDate(lead.nextFollowUp), at: lead.nextFollowUp });
  if (lead.convertedStudentId) items.push({ title: "Converted to student", detail: `Student ID: ${lead.convertedStudentId}`, at: lead.updatedAt });
  for (const n of lead.leadNotes) items.push({ title: "Note added", detail: n.body.slice(0, 80), at: n.createdAt });

  items.sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <Card>
      <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border pl-4">
          {items.map((item, i) => (
            <li key={i} className="relative">
              <span aria-hidden className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
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

function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{icon}{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
