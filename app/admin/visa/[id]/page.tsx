import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { Tabs, TabsContent } from "@/components/ui/overlays";
import { formatDate } from "@/lib/utils";
import {
  VISA_STATUS_LABELS,
  type VisaStatus,
} from "@/lib/constants/visa";
import { ChevronLeft, Globe, Building2, FileText, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

type VisaDetail = {
  id: string;
  applicationId: string;
  stage: string;
  visaType: string | null;
  submittedAt: Date | null;
  biometricsAt: Date | null;
  interviewAt: Date | null;
  decisionAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  application: {
    id: string;
    applicationNumber: string;
    stageKey: string;
    status: string;
    priority: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      studentId: string;
      email: string;
      phone: string | null;
    };
    country: { id: string; name: string; flag: string | null };
    university: { id: string; name: string } | null;
    course: { id: string; name: string } | null;
  };
  documents: {
    id: string;
    name: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    status: string;
    uploadedAt: Date | null;
    reviewedAt: Date | null;
    expiresAt: Date | null;
    requirement: { id: string; name: string; appliesTo: string } | null;
  }[];
  timeline: {
    id: string;
    type: "stage_change" | "audit";
    fromStage?: string | null;
    toStage?: string;
    note?: string | null;
    action?: string;
    oldValue?: unknown;
    newValue?: unknown;
    actor: string | null;
    createdAt: Date;
  }[];
};

export default async function VisaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const visa = (await prisma.visaApplication.findFirst({
    where: { id, deletedAt: null },
    include: {
      application: {
        select: {
          id: true,
          applicationNumber: true,
          stageKey: true,
          status: true,
          priority: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentId: true,
              email: true,
              phone: true,
            },
          },
          country: { select: { id: true, name: true, flag: true } },
          university: { select: { id: true, name: true } },
          course: { select: { id: true, name: true } },
        },
      },
    },
  })) as VisaDetail | null;

  if (!visa) notFound();

  // Documents relevant to this application
  const documents = await prisma.document.findMany({
    where: {
      deletedAt: null,
      applicationId: visa.applicationId,
    },
    select: {
      id: true,
      name: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      status: true,
      uploadedAt: true,
      reviewedAt: true,
      expiresAt: true,
      requirement: { select: { id: true, name: true, appliesTo: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Timeline = ApplicationStatusHistory + audit logs merged
  const [history, auditEntries] = await Promise.all([
    prisma.applicationStatusHistory.findMany({
      where: { applicationId: visa.applicationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.auditLog.findMany({
      where: { entity: "VisaApplication", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // Resolve actor names for history entries
  const changedByIds = [
    ...new Set(
      history
        .map((h) => h.changedById)
        .filter((id): id is string => !!id),
    ),
  ];
  const users = changedByIds.length
    ? await prisma.user.findMany({
        where: { id: { in: changedByIds } },
        select: { id: true, name: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const timeline = [
    ...history.map((h) => ({
      id: h.id,
      type: "stage_change" as const,
      fromStage: h.fromStage,
      toStage: h.toStage,
      note: h.note,
      actor: h.changedById ? userMap.get(h.changedById) ?? "System" : "System",
      createdAt: h.createdAt,
    })),
    ...auditEntries.map((a) => ({
      id: a.id,
      type: "audit" as const,
      action: a.action,
      oldValue: a.oldValue,
      newValue: a.newValue,
      actor: null,
      createdAt: a.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stageLabel = VISA_STATUS_LABELS[visa.stage as VisaStatus] ?? visa.stage;

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/visa"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Visa Management
        </Link>
      </div>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" aria-hidden />
            {visa.application.applicationNumber}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span>{visa.application.student.firstName} {visa.application.student.lastName}</span>
            <span className="text-muted-foreground">·</span>
            <span>{visa.application.country.flag} {visa.application.country.name}</span>
            {visa.visaType && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>{visa.visaType}</span>
              </>
            )}
          </span>
        }
        breadcrumbs={["Admin", "Visa Management", visa.application.applicationNumber]}
        actions={<StatusBadge status={visa.stage} />}
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Stage", stageLabel],
          ["Submitted", visa.submittedAt ? formatDate(visa.submittedAt) : "—"],
          ["Decision", visa.decisionAt ? formatDate(visa.decisionAt) : "—"],
          ["Documents", documents.length],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "documents", label: `Documents (${documents.length})` },
          { value: "timeline", label: `Timeline (${timeline.length})` },
        ]}
        defaultValue="overview"
      >
        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Visa details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Stage" value={<StatusBadge status={visa.stage} />} />
                <Row label="Visa type" value={visa.visaType ?? "—"} />
                <Row label="Submission date" value={visa.submittedAt ? formatDate(visa.submittedAt) : "—"} />
                <Row label="Biometrics date" value={visa.biometricsAt ? formatDate(visa.biometricsAt) : "—"} />
                <Row label="Interview date" value={visa.interviewAt ? formatDate(visa.interviewAt) : "—"} />
                <Row label="Decision date" value={visa.decisionAt ? formatDate(visa.decisionAt) : "—"} />
                <Row label="Created" value={formatDate(visa.createdAt)} />
                <Row label="Updated" value={formatDate(visa.updatedAt)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Application context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  label="Application"
                  value={
                    <Link href={`/admin/applications/${visa.application.id}`} className="font-mono text-xs text-primary hover:underline">
                      {visa.application.applicationNumber}
                    </Link>
                  }
                />
                <Row
                  label="Student"
                  value={
                    <Link href={`/admin/students/${visa.application.student.id}`} className="text-primary hover:underline">
                      {visa.application.student.firstName} {visa.application.student.lastName}
                    </Link>
                  }
                />
                <Row label="Student ID" value={visa.application.student.studentId} />
                <Row label="Email" value={visa.application.student.email} />
                {visa.application.student.phone && (
                  <Row label="Phone" value={visa.application.student.phone} />
                )}
                <Row label="Country" value={
                  <span className="inline-flex items-center gap-1">
                    {visa.application.country.flag && <span aria-hidden>{visa.application.country.flag}</span>}
                    {visa.application.country.name}
                  </span>
                } />
                {visa.application.university && (
                  <Row
                    label="University"
                    value={
                      <Link href={`/admin/universities/${visa.application.university.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Building2 className="h-3.5 w-3.5" aria-hidden />
                        {visa.application.university.name}
                      </Link>
                    }
                  />
                )}
                {visa.application.course && (
                  <Row label="Course" value={visa.application.course.name} />
                )}
              </CardContent>
            </Card>

            {visa.notes && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{visa.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" aria-hidden />
                Documents for this application
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <EmptyState title="No documents" description="No documents have been uploaded for this application." />
              ) : (
                <TableShell headers={["Document", "Type", "Size", "Status", "Uploaded", "Reviewed", "Expires"]}>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2.5 font-medium">{d.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{d.requirement?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {d.fileSize < 1024 * 1024
                          ? `${(d.fileSize / 1024).toFixed(1)} KB`
                          : `${(d.fileSize / 1024 / 1024).toFixed(1)} MB`}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{d.uploadedAt ? formatDate(d.uploadedAt) : "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{d.reviewedAt ? formatDate(d.reviewedAt) : "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{d.expiresAt ? formatDate(d.expiresAt) : "—"}</td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden />
                Visa timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <EmptyState title="No timeline events" />
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {timeline.map((t) => (
                    <li key={`${t.type}-${t.id}`}>
                      <span
                        className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary"
                        aria-hidden
                      />
                      {t.type === "stage_change" ? (
                        <>
                          <p className="text-sm font-medium">
                            {t.fromStage ?? "—"} → {t.toStage}
                          </p>
                          {t.note && (
                            <p className="text-xs text-muted-foreground">{t.note}</p>
                          )}
                          {t.actor && (
                            <p className="text-xs text-muted-foreground">by {t.actor}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-mono text-xs font-medium">{t.action}</p>
                          {(t.oldValue || t.newValue) && (
                            <p className="text-xs text-muted-foreground">
                              {t.oldValue ? JSON.stringify(t.oldValue) : "{}"} →{" "}
                              {t.newValue ? JSON.stringify(t.newValue) : "{}"}
                            </p>
                          )}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString("en-GB")}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}
