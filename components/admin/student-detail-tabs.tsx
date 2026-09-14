"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import { StatusBadge, EmptyState, TableShell } from "@/components/shared";
import { PassportValue } from "@/components/admin/passport-value";
import {
  User, FileText, FolderKanban, CreditCard, CheckSquare,
  ScrollText, LayoutDashboard, type LucideIcon,
} from "lucide-react";

type Tab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

const TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "profile", label: "Profile", icon: User },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "applications", label: "Applications", icon: FolderKanban },
  { id: "finance", label: "Finance", icon: CreditCard },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "activity", label: "Activity", icon: ScrollText },
];

export type StudentDetailData = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  nationality: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  passportNumber: string | null;
  passportIssueDate: Date | null;
  passportExpiryDate: Date | null;
  passportIssuingCountry: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  profilePhotoUrl: string | null;
  status: string;
  createdAt: Date;
  branch: { id: string; name: string } | null;
  employee: { id: string; user: { name: string; email: string }; title: string | null } | null;
  academicRecords: { id: string; level: string; institution: string; group: string | null; result: string | null; passingYear: number | null }[];
  englishProficiencies: { id: string; testType: string; overallScore: number | null; testDate: Date | null }[];
  applications: {
    id: string; applicationNumber: string; stageKey: string; status: string; createdAt: Date;
    country: { name: string };
    statusHistory: { id: string; fromStage: string | null; toStage: string; note: string | null; createdAt: Date }[];
  }[];
  documents: { id: string; name: string; status: string; category: string | null; createdAt: Date }[];
  payments: { id: string; amount: number; currency: string; status: string; paymentDate: Date | null; createdAt: Date; paymentMethod: string }[];
  invoices: { id: string; invoiceNumber: string; total: number; paidAmount: number; dueAmount: number; status: string; dueDate: Date | null }[];
  tasks: { id: string; title: string; status: string; priority: string; dueDate: Date | null }[];
  conversations: { id: string; lastMessageAt: Date; employee: { user: { name: string } } }[];
  auditActivity: { id: string; action: string; createdAt: Date }[];
  docsPercent: number;
  docsApproved: number;
  docsTotal: number;
  payLabel: string;
  payDue: number;
  payTotal: number;
  payInvoices: number;
};

export function StudentDetailTabs({ data }: { data: StudentDetailData }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div>
      {/* Premium tab bar */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex overflow-x-auto border-b border-border bg-muted/20">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/60 hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "documents" && data.documents.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{data.documents.length}</span>
              )}
              {tab.id === "applications" && data.applications.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{data.applications.length}</span>
              )}
              {tab.id === "finance" && data.invoices.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{data.invoices.length}</span>
              )}
              {tab.id === "tasks" && data.tasks.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{data.tasks.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="p-6">
          {activeTab === "overview" && <OverviewTab data={data} />}
          {activeTab === "profile" && <ProfileTab data={data} />}
          {activeTab === "documents" && <DocumentsTab data={data} />}
          {activeTab === "applications" && <ApplicationsTab data={data} />}
          {activeTab === "finance" && <FinanceTab data={data} />}
          {activeTab === "tasks" && <TasksTab data={data} />}
          {activeTab === "activity" && <ActivityTab data={data} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: StudentDetailData }) {
  const upcomingTasks = data.tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS").slice(0, 6);
  const currentApp = data.applications[0];
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Current Application" value={currentApp ? currentApp.applicationNumber : "No application"} sub={currentApp?.country.name} href={currentApp ? `/admin/applications/${currentApp.id}` : undefined} />
        <SummaryCard label="Current Stage" value={currentApp ? titleCase(currentApp.stageKey) : "—"} />
        <SummaryCard label="Document Completion" value={`${data.docsPercent}%`} sub={`${data.docsApproved}/${data.docsTotal} approved`} />
        <SummaryCard label="Payment Status" value={data.payLabel === "NO_INVOICES" ? "No invoices" : data.payLabel} sub={data.payInvoices > 0 ? `Due ${formatMoney(data.payDue)} of ${formatMoney(data.payTotal)}` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Counselor */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Assigned Counselor</h3>
          {data.employee ? (
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {data.employee.user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div>
                <Link href={`/admin/employees/${data.employee.id}`} className="text-sm font-semibold text-primary hover:underline">{data.employee.user.name}</Link>
                <p className="text-xs text-muted-foreground">{data.employee.title ?? "Counselor"}</p>
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No counselor assigned.</p>}
        </div>

        {/* Upcoming tasks */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Upcoming Tasks</h3>
          {upcomingTasks.length === 0 ? <p className="text-sm text-muted-foreground">No open tasks.</p> : (
            <ul className="space-y-2">
              {upcomingTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{t.title}</span>
                  <span className="flex items-center gap-2">
                    {t.dueDate && <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>}
                    <StatusBadge status={t.priority} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Conversations */}
      {data.conversations.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Recent Conversations</h3>
          <ul className="space-y-2 text-sm">
            {data.conversations.map((c) => (
              <li key={c.id} className="flex justify-between rounded-lg border border-border px-3 py-2">
                <span className="font-medium">{c.employee.user.name}</span>
                <span className="text-xs text-muted-foreground">{formatDate(c.lastMessageAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ data }: { data: StudentDetailData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DetailCard title="Personal Information">
        <Row label="Student ID" value={data.studentId} />
        <Row label="Email" value={data.email} />
        <Row label="Phone" value={data.phone ?? "—"} />
        <Row label="WhatsApp" value={data.whatsapp ?? "—"} />
        <Row label="Date of Birth" value={formatDate(data.dateOfBirth)} />
        <Row label="Gender" value={data.gender ? titleCase(data.gender) : "—"} />
        <Row label="Nationality" value={data.nationality ?? "—"} />
        <Row label="Address" value={[data.address, data.city, data.country].filter(Boolean).join(", ") || "—"} />
      </DetailCard>

      <DetailCard title="Passport">
        <Row label="Passport Number" value={<PassportValue passport={data.passportNumber} />} />
        <Row label="Issue Date" value={formatDate(data.passportIssueDate)} />
        <Row label="Expiry Date" value={formatDate(data.passportExpiryDate)} />
        <Row label="Issuing Country" value={data.passportIssuingCountry ?? "—"} />
      </DetailCard>

      <DetailCard title="Emergency Contact">
        <Row label="Name" value={data.emergencyContactName ?? "—"} />
        <Row label="Phone" value={data.emergencyContactPhone ?? "—"} />
        <Row label="Relation" value={data.emergencyContactRelation ?? "—"} />
      </DetailCard>

      <DetailCard title="Academic Background">
        {data.academicRecords.length === 0 ? <EmptyState title="No academic records" /> : (
          <TableShell headers={["Level", "Institution", "Result", "Year"]}>
            {data.academicRecords.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 font-medium">{r.level}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.institution}</td>
                <td className="px-4 py-2.5">{r.result ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.passingYear ?? "—"}</td>
              </tr>
            ))}
          </TableShell>
        )}
      </DetailCard>

      <DetailCard title="English Proficiency">
        {data.englishProficiencies.length === 0 ? <EmptyState title="No test records" /> : (
          <ul className="space-y-2 text-sm">
            {data.englishProficiencies.map((e) => (
              <li key={e.id} className="flex justify-between rounded-lg border border-border px-3 py-2">
                <span className="font-medium">{titleCase(e.testType)}</span>
                <span>Overall: <strong>{e.overallScore ?? "—"}</strong></span>
                <span className="text-muted-foreground">{formatDate(e.testDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </DetailCard>

      <DetailCard title="Account">
        <Row label="Status" value={<StatusBadge status={data.status} />} />
        <Row label="Branch" value={data.branch?.name ?? "—"} />
        <Row label="Registered" value={formatDate(data.createdAt)} />
      </DetailCard>
    </div>
  );
}

function DocumentsTab({ data }: { data: StudentDetailData }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {data.documents.length === 0 ? <EmptyState title="No documents" description="Documents will appear here when the student uploads them." /> : (
        <div className="space-y-2">
          {data.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/30">
              <div>
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.category ?? "Uncategorized"} · {formatDate(d.createdAt)}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationsTab({ data }: { data: StudentDetailData }) {
  return (
    <div className="space-y-4">
      {data.applications.length === 0 ? (
        <EmptyState title="No applications" description="Applications will appear here when the student applies to a university." />
      ) : (
        data.applications.map((app) => (
          <div key={app.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <Link href={`/admin/applications/${app.id}`} className="font-mono text-sm font-bold text-primary hover:underline">
                {app.applicationNumber}
              </Link>
              <div className="flex gap-2">
                <StatusBadge status={app.stageKey} />
                <StatusBadge status={app.status} />
              </div>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{app.country.name} · Created {formatDate(app.createdAt)}</p>

            {/* Timeline */}
            {app.statusHistory.length > 0 && (
              <ol className="relative space-y-3 border-l border-border pl-5">
                {app.statusHistory.map((h) => (
                  <li key={h.id}>
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                    <p className="text-sm font-medium">
                      {h.fromStage ? `${titleCase(h.fromStage)} → ${titleCase(h.toStage)}` : titleCase(h.toStage)}
                    </p>
                    {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("en-GB")}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function FinanceTab({ data }: { data: StudentDetailData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Payments ({data.payments.length})</h3>
        {data.payments.length === 0 ? <EmptyState title="No payments" /> : (
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm">
                <span>{formatDate(p.paymentDate ?? p.createdAt)}</span>
                <span className="font-semibold">{formatMoney(p.amount, p.currency)}</span>
                <span className="text-xs text-muted-foreground">{p.paymentMethod}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Invoices ({data.invoices.length})</h3>
        {data.invoices.length === 0 ? <EmptyState title="No invoices" /> : (
          <TableShell headers={["Invoice", "Total", "Paid", "Due", "Status"]}>
            {data.invoices.map((i) => (
              <tr key={i.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/invoices/${i.id}`} className="font-mono text-xs text-primary hover:underline">{i.invoiceNumber}</Link>
                </td>
                <td className="px-4 py-2.5">{formatMoney(i.total)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatMoney(i.paidAmount)}</td>
                <td className="px-4 py-2.5 font-medium">{formatMoney(i.dueAmount)}</td>
                <td className="px-4 py-2.5"><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </TableShell>
        )}
      </div>
    </div>
  );
}

function TasksTab({ data }: { data: StudentDetailData }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {data.tasks.length === 0 ? <EmptyState title="No tasks" /> : (
        <div className="space-y-2">
          {data.tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-muted/30">
              <span className="font-semibold">{t.title}</span>
              <span className="flex items-center gap-2">
                {t.dueDate && <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>}
                <StatusBadge status={t.status} />
                <StatusBadge status={t.priority} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ data }: { data: StudentDetailData }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {data.auditActivity.length === 0 ? <EmptyState title="No recorded activity" /> : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {data.auditActivity.map((a) => (
            <li key={a.id}>
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground" aria-hidden />
              <p className="font-mono text-xs font-semibold">{a.action}</p>
              <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("en-GB")}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Helpers ──

function SummaryCard({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {href ? (
        <Link href={href} className="mt-1 block text-sm font-bold text-primary hover:underline">{value}</Link>
      ) : (
        <p className="mt-1 text-sm font-bold">{value}</p>
      )}
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium">{value}</span>
    </div>
  );
}
