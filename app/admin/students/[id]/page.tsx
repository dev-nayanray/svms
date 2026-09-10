import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge, TableShell, EmptyState } from "@/components/shared";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import { documentCompletion, paymentStatus } from "@/lib/utils/student-insights";
import { PassportValue } from "@/components/admin/passport-value";

export const dynamic = "force-dynamic";

export default async function Student360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await prisma.student.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: true,
      employee: { include: { user: true, branch: true } },
      branch: true,
      academicRecords: true,
      englishProficiencies: true,
      applications: {
        where: { deletedAt: null },
        include: {
          country: true,
          statusHistory: { orderBy: { createdAt: "desc" }, take: 20 },
        },
        orderBy: { createdAt: "desc" },
      },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] },
      conversations: { include: { employee: { include: { user: true } } }, orderBy: { lastMessageAt: "desc" } },
    },
  });
  if (!student) notFound();

  const auditActivity = await prisma.auditLog.findMany({
    where: { entity: "Student", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const docs = documentCompletion(student.documents);
  const pay = paymentStatus(student.invoices);
  const currentApp = student.applications[0];
  const upcomingTasks = student.tasks
    .filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS")
    .slice(0, 6);

  const fullName = `${student.firstName} ${student.lastName}`;

  return (
    <>
      <PageHeader
        title={fullName}
        description={`${student.studentId} · ${student.email}`}
        breadcrumbs={["Admin", "Students", fullName]}
        actions={
          <div className="flex items-center gap-2">
            {student.deletedAt && <StatusBadge status="ARCHIVED" />}
            <StatusBadge status={student.status} />
          </div>
        }
      />

      {/* Student 360 summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Application</p>
            {currentApp ? (
              <>
                <Link href={`/admin/applications/${currentApp.id}`} className="mt-1 block font-mono text-sm font-semibold text-primary hover:underline">
                  {currentApp.applicationNumber}
                </Link>
                <p className="text-xs text-muted-foreground">{currentApp.country.name}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No application</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Stage</p>
            <p className="mt-1 text-sm font-semibold">{currentApp ? titleCase(currentApp.stageKey) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document Completion</p>
            <p className="mt-1 text-2xl font-semibold">{docs.percent}%</p>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted" role="progressbar" aria-valuenow={docs.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Document completion">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${docs.percent}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{docs.approved}/{docs.total} approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment Status</p>
            <p className="mt-1 text-sm font-semibold">
              {pay.label === "NO_INVOICES" ? "No invoices" : <StatusBadge status={pay.label} />}
            </p>
            {pay.invoices > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Due {formatMoney(pay.due)} of {formatMoney(pay.total)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Student ID" value={student.studentId} />
            <Row label="Email" value={student.email} />
            <Row label="Phone" value={student.phone ?? "—"} />
            <Row label="Date of Birth" value={formatDate(student.dateOfBirth)} />
            <Row label="Gender" value={student.gender ? titleCase(student.gender) : "—"} />
            <Row label="Nationality" value={student.nationality ?? "—"} />
            <Row label="Address" value={[student.address, student.city, student.country].filter(Boolean).join(", ") || "—"} />
            <Row label="Emergency Contact" value={student.emergencyContactName ? `${student.emergencyContactName} (${student.emergencyContactPhone})` : "—"} />
            <Row label="Branch" value={student.branch?.name ?? "—"} />
            <Row label="Registered" value={formatDate(student.createdAt)} />
          </CardContent>
        </Card>

        {/* Passport (sensitive — masked until revealed) */}
        <Card>
          <CardHeader><CardTitle>Passport</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Passport Number" value={<PassportValue passport={student.passportNumber} />} />
            <Row label="Issue Date" value={formatDate(student.passportIssueDate)} />
            <Row label="Expiry Date" value={formatDate(student.passportExpiryDate)} />
          </CardContent>
        </Card>

        {/* Assigned counselor + upcoming tasks */}
        <Card>
          <CardHeader><CardTitle>Assigned Counselor</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {student.employee ? (
              <>
                <Row label="Name" value={<Link href={`/admin/employees/${student.employee.id}`} className="text-primary hover:underline">{student.employee.user.name}</Link>} />
                <Row label="Title" value={student.employee.title ?? "—"} />
                <Row label="Email" value={student.employee.user.email} />
              </>
            ) : (
              <p className="text-muted-foreground">No counselor assigned.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Upcoming Tasks</CardTitle></CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 && <p className="text-sm text-muted-foreground">No open tasks.</p>}
            <ul className="space-y-1.5 text-sm">
              {upcomingTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="font-medium">{t.title}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>
                    <StatusBadge status={t.priority} />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Academic background */}
        <Card>
          <CardHeader><CardTitle>Academic Background</CardTitle></CardHeader>
          <CardContent>
            {student.academicRecords.length === 0 ? <EmptyState title="No academic records" /> : (
              <TableShell headers={["Level", "Institution", "Result", "Year"]}>
                {student.academicRecords.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-medium">{r.level}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.institution}</td>
                    <td className="px-4 py-2.5">{r.result ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.passingYear ?? "—"}</td>
                  </tr>
                ))}
              </TableShell>
            )}
          </CardContent>
        </Card>

        {/* English proficiency */}
        <Card>
          <CardHeader><CardTitle>English Proficiency</CardTitle></CardHeader>
          <CardContent>
            {student.englishProficiencies.length === 0 ? <EmptyState title="No test records" /> : (
              <ul className="space-y-1.5 text-sm">
                {student.englishProficiencies.map((e) => (
                  <li key={e.id} className="flex justify-between rounded-md border border-border px-3 py-2">
                    <span className="font-medium">{titleCase(e.testType)}</span>
                    <span>Overall: <strong>{e.overallScore ?? "—"}</strong></span>
                    <span className="text-muted-foreground">{formatDate(e.testDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Applications */}
      <Card>
        <CardHeader><CardTitle>Applications</CardTitle></CardHeader>
        <CardContent>
          {student.applications.length === 0 ? <EmptyState title="No applications" /> : (
            <TableShell headers={["Number", "Country", "Stage", "Status", "Created"]}>
              {student.applications.map((a) => (
                <tr key={a.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/applications/${a.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {a.applicationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{a.country.name}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={a.stageKey} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(a.createdAt)}</td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Documents / Payments / Invoices */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Documents ({docs.total})</CardTitle></CardHeader>
          <CardContent>
            {student.documents.length === 0 ? <EmptyState title="No documents" /> : (
              <ul className="space-y-1.5 text-sm">
                {student.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="font-medium">{d.name}</span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payments ({student.payments.length})</CardTitle></CardHeader>
          <CardContent>
            {student.payments.length === 0 ? <EmptyState title="No payments" /> : (
              <ul className="space-y-1.5 text-sm">
                {student.payments.map((p) => (
                  <li key={p.id} className="flex justify-between rounded-md border border-border px-3 py-2">
                    <span>{formatDate(p.paymentDate ?? p.createdAt)}</span>
                    <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent>
          {student.invoices.length === 0 ? <EmptyState title="No invoices" /> : (
            <TableShell headers={["Invoice", "Total", "Paid", "Due", "Status"]}>
              {student.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/invoices/${i.id}`} className="font-mono text-xs text-primary hover:underline">
                      {i.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{formatMoney(i.total)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatMoney(i.paidAmount)}</td>
                  <td className="px-4 py-2.5 font-medium">{formatMoney(i.dueAmount)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Tasks + Messages */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent>
            {student.tasks.length === 0 ? <EmptyState title="No tasks" /> : (
              <ul className="space-y-1.5 text-sm">
                {student.tasks.slice(0, 10).map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="font-medium">{t.title}</span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Messages</CardTitle></CardHeader>
          <CardContent>
            {student.conversations.length === 0 ? (
              <EmptyState title="No conversations" description="Conversations appear when the student messages their counselor." />
            ) : (
              <ul className="space-y-1.5 text-sm">
                {student.conversations.map((c) => (
                  <li key={c.id} className="flex justify-between rounded-md border border-border px-3 py-2">
                    <span>{c.employee.user.name}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(c.lastMessageAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Application timeline */}
      <Card>
        <CardHeader><CardTitle>Application Timeline</CardTitle></CardHeader>
        <CardContent>
          {student.applications.every((a) => a.statusHistory.length === 0) ? (
            <EmptyState title="No timeline events yet" />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {student.applications.flatMap((a) =>
                a.statusHistory.map((h) => ({ ...h, appNumber: a.applicationNumber }))
              )
                .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
                .slice(0, 25)
                .map((h) => (
                  <li key={h.id}>
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                    <p className="text-sm font-medium">
                      <span className="font-mono text-xs text-muted-foreground">{h.appNumber}</span>{" "}
                      {h.fromStage ? `${titleCase(h.fromStage)} → ${titleCase(h.toStage)}` : titleCase(h.toStage)}
                    </p>
                    {h.note && <p className="text-sm text-muted-foreground">{h.note}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("en-GB")}</p>
                  </li>
                ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Audit activity (complete case history) */}
      <Card>
        <CardHeader><CardTitle>Audit Activity</CardTitle></CardHeader>
        <CardContent>
          {auditActivity.length === 0 ? (
            <EmptyState title="No recorded activity" />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {auditActivity.map((a) => (
                <li key={a.id}>
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground" aria-hidden />
                  <p className="font-mono text-xs font-medium">{a.action}</p>
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
