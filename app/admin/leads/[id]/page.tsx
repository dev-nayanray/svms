import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, EmptyState } from "@/components/shared";
import { formatDate } from "@/lib/utils";
import { LEAD_SOURCE_LABELS, type LeadSource } from "@/lib/constants/leads";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: { employee: { include: { user: true, branch: true } } },
  });
  if (!lead) notFound();

  // Activity timeline = audit trail for this lead
  const activities = await prisma.auditLog.findMany({
    where: { entity: "Lead", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // Tasks related to the converted student (leads have no direct tasks pre-conversion)
  const tasks = lead.convertedStudentId
    ? await prisma.task.findMany({
        where: { studentId: lead.convertedStudentId },
        include: { student: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  const convertedStudent = lead.convertedStudentId
    ? await prisma.student.findUnique({ where: { id: lead.convertedStudentId } })
    : null;

  const country = lead.interestedCountry
    ? await prisma.country.findUnique({ where: { id: lead.interestedCountry } })
    : null;

  return (
    <>
      <PageHeader
        title={lead.name}
        description={`Lead since ${formatDate(lead.createdAt)}`}
        breadcrumbs={["Admin", "Leads", lead.name]}
        actions={
          <div className="flex items-center gap-2">
            {lead.archivedAt && <StatusBadge status="ARCHIVED" />}
            <StatusBadge status={lead.status} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Overview */}
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Status" value={<StatusBadge status={lead.status} />} />
            <Row label="Source" value={lead.source ? (LEAD_SOURCE_LABELS[lead.source as LeadSource] ?? lead.source) : "—"} />
            <Row label="Created" value={formatDate(lead.createdAt)} />
            <Row label="Archived" value={lead.archivedAt ? formatDate(lead.archivedAt) : "No"} />
            {convertedStudent && (
              <Row
                label="Converted to"
                value={
                  <Link href={`/admin/students/${convertedStudent.id}`} className="text-primary hover:underline">
                    {convertedStudent.firstName} {convertedStudent.lastName} ({convertedStudent.studentId})
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Email" value={lead.email ?? "—"} />
            <Row label="Phone" value={lead.phone ?? "—"} />
          </CardContent>
        </Card>

        {/* Academic information */}
        <Card>
          <CardHeader><CardTitle>Academic Information</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Education level" value={lead.educationLevel ?? "—"} />
            <Row label="English score" value={lead.englishScore ?? "—"} />
          </CardContent>
        </Card>

        {/* Interested destinations */}
        <Card>
          <CardHeader><CardTitle>Interested Destinations</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Country" value={country?.name ?? "—"} />
            <Row label="Preferred intake" value={lead.preferredIntake ?? "—"} />
          </CardContent>
        </Card>

        {/* Assigned employee */}
        <Card>
          <CardHeader><CardTitle>Assigned Employee</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {lead.employee ? (
              <>
                <Row label="Name" value={<Link href={`/admin/employees/${lead.employee.id}`} className="text-primary hover:underline">{lead.employee.user.name}</Link>} />
                <Row label="Title" value={lead.employee.title ?? "—"} />
                <Row label="Branch" value={lead.employee.branch?.name ?? "—"} />
                <Row label="Email" value={lead.employee.user.email} />
              </>
            ) : (
              <p className="text-muted-foreground">No employee assigned yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {lead.convertedStudentId
                  ? "No tasks for the converted student."
                  : "Tasks become available after the lead is converted to a student."}
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="font-medium">{t.title}</span>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          {lead.notes ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{lead.notes}</pre>
          ) : (
            <EmptyState title="No notes yet" description="Add notes from the lead list or edit form." />
          )}
        </CardContent>
      </Card>

      {/* Activity timeline */}
      <Card>
        <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <EmptyState title="No recorded activity" />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {activities.map((a) => (
                <li key={a.id}>
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                  <p className="font-mono text-xs font-medium">{a.action}</p>
                  {(a.oldValue || a.newValue) && (
                    <p className="text-xs text-muted-foreground">
                      {a.oldValue ? JSON.stringify(a.oldValue) : "{}"} → {a.newValue ? JSON.stringify(a.newValue) : "{}"}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("en-GB")}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}
