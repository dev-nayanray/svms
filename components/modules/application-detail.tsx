import { prisma } from "@/lib/db";
import { StatusBadge, EmptyState } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDate, titleCase } from "@/lib/utils";
import { notFound } from "next/navigation";
import { StageChangeForm } from "./stage-change-form";
import { AddNoteForm } from "@/components/admin/add-note-form";

export async function ApplicationDetail({
  id,
  canManage,
}: {
  id: string;
  basePath: string;
  canManage: boolean;
}) {
  const app = await prisma.application.findFirst({
    where: { id, deletedAt: null },
    include: {
      student: { include: { employee: { include: { user: true } } } },
      country: true,
      university: true,
      course: true,
      intake: true,
      visaApplication: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
      documents: { where: { deletedAt: null } },
      payments: { where: { deletedAt: null } },
      tasks: { orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 10 },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!app) notFound();

  const stages = await prisma.applicationStage.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-mono text-lg font-semibold">{app.applicationNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {app.student.firstName} {app.student.lastName} · {app.country.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={app.stageKey} />
          <StatusBadge status={app.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent>
            {app.statusHistory.length === 0 && <EmptyState title="No history yet" />}
            <ol className="relative space-y-4 border-l border-border pl-5">
              {app.statusHistory.map((h) => (
                <li key={h.id}>
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                  <p className="text-sm font-medium">
                    {h.fromStage ? `${titleCase(h.fromStage)} → ${titleCase(h.toStage)}` : titleCase(h.toStage)}
                  </p>
                  {h.note && <p className="text-sm text-muted-foreground">{h.note}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(h.createdAt)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {canManage && (
            <Card>
              <CardHeader><CardTitle>Change Stage</CardTitle></CardHeader>
              <CardContent>
                <StageChangeForm applicationId={app.id} stages={stages.map((s) => ({ key: s.key, label: titleCase(s.name) }))} currentStage={app.stageKey} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Detail label="Counselor" value={app.student.employee?.user.name ?? "—"} />
              <Detail label="University" value={app.university?.name ?? "—"} />
              <Detail label="Course" value={app.course?.name ?? "—"} />
              <Detail label="Intake" value={app.intake?.name ?? "—"} />
              <Detail label="Priority" value={titleCase(app.priority)} />
              <Detail label="Submitted" value={formatDate(app.submissionDate)} />
              <Detail label="Documents" value={String(app.documents.length)} />
              <Detail label="Payments" value={String(app.payments.length)} />
              <Detail label="Visa Stage" value={app.visaApplication ? titleCase(app.visaApplication.stage) : "Not started"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Visa</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {app.visaApplication ? (
                <>
                  <Detail label="Stage" value={titleCase(app.visaApplication.stage)} />
                  <Detail label="Submitted" value={formatDate(app.visaApplication.submittedAt)} />
                  <Detail label="Decision" value={formatDate(app.visaApplication.decisionAt)} />
                </>
              ) : (
                <p className="text-muted-foreground">Visa tracking starts at VISA_PREPARATION.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader><CardTitle>Documents ({app.documents.length})</CardTitle></CardHeader>
        <CardContent>
          {app.documents.length === 0 ? <EmptyState title="No documents" /> : (
            <ul className="space-y-1.5 text-sm">
              {app.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="font-medium">{d.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(d.uploadedAt)}</span>
                    <StatusBadge status={d.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
        <CardContent>
          {app.tasks.length === 0 ? <EmptyState title="No tasks" /> : (
            <ul className="space-y-1.5 text-sm">
              {app.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="font-medium">{t.title}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>
                    <StatusBadge status={t.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader><CardTitle>Payments ({app.payments.length})</CardTitle></CardHeader>
        <CardContent>
          {app.payments.length === 0 ? <EmptyState title="No payments" /> : (
            <ul className="space-y-1.5 text-sm">
              {app.payments.map((p) => (
                <li key={p.id} className="flex justify-between rounded-md border border-border px-3 py-2">
                  <span>{formatDate(p.paymentDate ?? p.createdAt)}</span>
                  <span className="font-medium">{p.currency} {p.amount.toLocaleString()}</span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Notes (INTERNAL never exposed to students — this detail view is staff-only) */}
      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {app.notes.length === 0 && <EmptyState title="No notes yet" />}
          <ul className="space-y-2 text-sm">
            {app.notes.map((n) => (
              <li key={n.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={n.visibility} />
                  <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                </div>
                <p className="mt-1">{n.body}</p>
              </li>
            ))}
          </ul>
          {canManage && <AddNoteForm applicationId={app.id} />}
        </CardContent>
      </Card>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
