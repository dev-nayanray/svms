import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Badge, Separator } from "@/components/ui";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate, titleCase } from "@/lib/utils";
import { requireVisa, type VisaDetail } from "@/lib/services/visa-cases";
import { VisaStageChanger } from "@/components/employee/visa-stage-changer";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "requirements", label: "Requirements" },
  { value: "documents", label: "Documents" },
  { value: "timeline", label: "Timeline" },
  { value: "appointments", label: "Appointments" },
  { value: "decision", label: "Decision" },
  { value: "notes", label: "Notes" },
] as const;

const STAGE_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  PREPARATION: "warning", SUBMITTED: "info", BIOMETRICS: "info", INTERVIEW: "info",
  PROCESSING: "info", APPROVED: "success", REFUSED: "destructive", WITHDRAWN: "default", COMPLETED: "success",
};

export default async function EmployeeVisaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/visa");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const canEdit = hasPermission(role, "visa.manage");

  const { id } = await params;
  let visa: VisaDetail;
  try {
    visa = await requireVisa(scope, id);
  } catch {
    notFound();
  }

  const sp = await searchParams;
  const activeTab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "overview";

  return (
    <div>
      <Link href="/employee/visa" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Visa Applications
      </Link>

      <EmployeePageHeader
        title={`Visa — ${visa.application.student.firstName} ${visa.application.student.lastName}`}
        description={`${visa.application.applicationNumber} · ${visa.application.country?.flag ?? ""} ${visa.application.country?.name ?? "—"}${visa.visaType ? ` · ${visa.visaType}` : ""}`}
        actions={<Badge tone={STAGE_TONE[visa.stage] ?? "default"}>{titleCase(visa.stage)}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs tabs={TABS.map((t) => ({ value: t.value, label: t.label }))} defaultValue={activeTab}>
            <TabsContent value="overview"><OverviewTab visa={visa} /></TabsContent>
            <TabsContent value="requirements"><RequirementsTab visa={visa} /></TabsContent>
            <TabsContent value="documents"><DocumentsTab visa={visa} /></TabsContent>
            <TabsContent value="timeline"><TimelineTab visa={visa} /></TabsContent>
            <TabsContent value="appointments"><AppointmentsTab visa={visa} /></TabsContent>
            <TabsContent value="decision"><DecisionTab visa={visa} /></TabsContent>
            <TabsContent value="notes"><NotesTab visa={visa} /></TabsContent>
          </Tabs>
        </div>

        {/* Sidebar — stage changer */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Visa Stage</CardTitle></CardHeader>
            <CardContent>
              <VisaStageChanger visaId={visa.id} currentStage={visa.stage} canEdit={canEdit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Key Dates</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2 text-xs">
                <DateField label="Submitted" value={visa.submittedAt} />
                <DateField label="Biometrics" value={visa.biometricsAt} />
                <DateField label="Interview" value={visa.interviewAt} />
                <DateField label="Decision" value={visa.decisionAt} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ visa }: { visa: VisaDetail }) {
  return (
    <Card>
      <CardHeader><CardTitle>Visa information</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Field label="Visa type" value={visa.visaType ?? "—"} />
          <Field label="Stage" value={<Badge tone="info">{titleCase(visa.stage)}</Badge>} />
          <Field label="Student" value={<Link href={`/employee/students/${visa.application.student.id}`} className="text-primary hover:underline">{visa.application.student.firstName} {visa.application.student.lastName}</Link>} />
          <Field label="Application" value={<Link href={`/employee/applications/${visa.application.id}`} className="text-primary hover:underline">{visa.application.applicationNumber}</Link>} />
          <Field label="Country" value={`${visa.application.country?.flag ?? ""} ${visa.application.country?.name ?? "—"}`} />
          <Field label="University" value={visa.application.university?.name ?? "—"} />
          <Field label="Submitted" value={visa.submittedAt ? formatDate(visa.submittedAt) : "—"} />
          <Field label="Decision" value={visa.decisionAt ? formatDate(visa.decisionAt) : "—"} />
          <Field label="Created" value={formatDate(visa.createdAt)} />
        </dl>
      </CardContent>
    </Card>
  );
}

function RequirementsTab({ visa }: { visa: VisaDetail }) {
  if (visa.requirements.length === 0) {
    return <Card><CardContent className="p-8 text-center"><p className="text-sm font-medium">No visa requirements configured</p><p className="mt-1 text-xs text-muted-foreground">Country-specific requirements will appear here when configured by an admin.</p></CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader><CardTitle>Visa requirements ({visa.requirements.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {visa.requirements.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{r.name}</p>
                {r.description && <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>}
              </div>
              {r.required ? <Badge tone="warning">Required</Badge> : <Badge tone="default">Optional</Badge>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DocumentsTab({ visa }: { visa: VisaDetail }) {
  if (visa.documents.length === 0) {
    return <Card><CardContent className="p-8 text-center"><p className="text-sm font-medium">No documents</p></CardContent></Card>;
  }
  const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
    REQUESTED: "warning", UPLOADED: "info", UNDER_REVIEW: "info", APPROVED: "success", REJECTED: "destructive",
  };
  return (
    <Card>
      <CardHeader><CardTitle>Documents ({visa.documents.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {visa.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-4">
              <div><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">Uploaded {d.uploadedAt ? formatDate(d.uploadedAt) : "—"}</p></div>
              <Badge tone={STATUS_TONE[d.status] ?? "default"}>{titleCase(d.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ visa }: { visa: VisaDetail }) {
  if (visa.stageHistory.length === 0) return <Card><CardContent className="p-8 text-center"><p className="text-sm font-medium">No stage history yet</p></CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle>Stage History ({visa.stageHistory.length})</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border pl-4">
          {visa.stageHistory.map((h) => (
            <li key={h.id} className="relative">
              <span aria-hidden className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
              <p className="text-sm font-medium">{h.fromStage ? titleCase(h.fromStage) : "—"} → {titleCase(h.toStage)}</p>
              <p className="text-xs text-muted-foreground">By {h.changedByName} · {formatDate(h.createdAt)}</p>
              {h.note && <p className="mt-1 text-xs italic text-muted-foreground">"{h.note}"</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function AppointmentsTab({ visa }: { visa: VisaDetail }) {
  if (visa.appointments.length === 0) return <Card><CardContent className="p-8 text-center"><p className="text-sm font-medium">No upcoming appointments</p></CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle>Upcoming appointments ({visa.appointments.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {visa.appointments.map((a) => (
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

function DecisionTab({ visa }: { visa: VisaDetail }) {
  if (!visa.decisionAt && visa.stage !== "APPROVED" && visa.stage !== "REFUSED" && visa.stage !== "WITHDRAWN") {
    return <Card><CardContent className="p-8 text-center"><p className="text-sm font-medium">No decision yet</p><p className="mt-1 text-xs text-muted-foreground">The decision will appear here once the visa stage reaches APPROVED, REFUSED, or WITHDRAWN.</p></CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader><CardTitle>Decision</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Decision date" value={visa.decisionAt ? formatDate(visa.decisionAt) : "—"} />
          <Field label="Stage" value={<Badge tone={STAGE_TONE[visa.stage] ?? "default"}>{titleCase(visa.stage)}</Badge>} />
        </dl>
        {visa.decisionReason && (<><Separator className="my-4" /><p className="text-xs font-medium text-muted-foreground">Decision reason</p><p className="mt-1 text-sm whitespace-pre-wrap">{visa.decisionReason}</p></>)}
      </CardContent>
    </Card>
  );
}

function NotesTab({ visa }: { visa: VisaDetail }) {
  if (!visa.notes) return <Card><CardContent className="p-8 text-center"><p className="text-sm font-medium">No notes</p></CardContent></Card>;
  return <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{visa.notes}</p></CardContent></Card>;
}

function DateField({ label, value }: { label: string; value: Date | null }) {
  return (<div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value ? formatDate(value) : "—"}</dd></div>);
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>);
}
