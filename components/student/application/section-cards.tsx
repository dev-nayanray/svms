"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  GraduationCap,
  IdCard,
  Mail,
  MapPin,
  MessageSquare,
  Stamp,
  University as UniversityIcon,
  UserRound,
  Receipt,
} from "lucide-react";
import { format, parseISO } from "date-fns";

// ── Types (mirror the service's student-safe view) ─────────────────

type StageMarker = {
  key: string;
  name: string;
  sortOrder: number;
  state: "completed" | "current" | "upcoming" | "skipped";
};

type AppView = {
  id: string;
  applicationNumber: string;
  country: { id: string; name: string; flag?: string | null } | null;
  university: {
    id: string;
    name: string;
    website?: string | null;
    city?: string | null;
    ranking?: number | null;
  } | null;
  course: {
    id: string;
    name: string;
    degreeLevel: string;
    duration?: string | null;
    tuitionFee?: number | null;
    currency?: string | null;
  } | null;
  intake: {
    id: string;
    name: string;
    month: number;
    year: number;
    deadline?: Date | string | null;
  } | null;
  stageKey: string;
  stageLabel: string;
  status: string;
  priority: string;
  lastUpdated: Date | string;
  createdAt: Date | string;
  submissionDate: Date | string | null;
  decisionDate: Date | string | null;
  counselor: {
    id: string;
    name: string;
    email: string;
    designation?: string | null;
  } | null;
  progress: {
    percent: number;
    currentIndex: number;
    total: number;
    passed: number;
    isComplete: boolean;
  };
  stages: StageMarker[];
  nextAction: {
    title: string;
    reason: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    ctaLabel: string;
    ctaHref: string;
  };
  importantDates: {
    label: string;
    date: Date | string | null;
    kind: "submission" | "decision" | "intake" | "visa" | "payment";
  }[];
  timeline: {
    id: string;
    fromStage: string | null;
    toStage: string;
    fromLabel: string;
    toLabel: string;
    note: string | null;
    createdAt: Date | string;
  }[];
  documents: {
    counts: {
      required: number;
      approved: number;
      underReview: number;
      rejected: number;
      pending: number;
    };
    items: {
      id: string;
      name: string;
      fileName: string;
      status: string;
      uploadedAt: Date | string | null;
      reviewedAt: Date | string | null;
      reviewNote: string | null;
      expiresAt: Date | string | null;
    }[];
  };
  tasks: {
    open: number;
    total: number;
    items: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      dueDate: Date | string | null;
    }[];
  };
  payments: {
    totals: { invoiceTotal: number; paid: number; due: number };
    nextOpenInvoice: {
      id: string;
      invoiceNumber: string;
      dueAmount: number;
      dueDate: Date | string | null;
      status: string;
    } | null;
    items: {
      id: string;
      amount: number;
      currency: string;
      paymentMethod: string;
      status: string;
      paymentDate: Date | string | null;
    }[];
  };
  invoices: {
    id: string;
    invoiceNumber: string;
    total: number;
    paidAmount: number;
    dueAmount: number;
    status: string;
    issueDate: Date | string | null;
    dueDate: Date | string | null;
  }[];
  visa: {
    id: string;
    stage: string;
    stageLabel: string;
    visaType: string | null;
    submittedAt: Date | string | null;
    biometricsAt: Date | string | null;
    interviewAt: Date | string | null;
    decisionAt: Date | string | null;
  } | null;
  notes: {
    id: string;
    body: string;
    visibility: string;
    createdAt: Date | string;
  }[];
};

// ── Helpers ───────────────────────────────────────────────────────

function fmtDate(d?: Date | string | null): string {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function fmtDateTime(d?: Date | string | null): string {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "MMM d, yyyy 'at' h:mm a");
  } catch {
    return "—";
  }
}

function priorityTone(p: string): "default" | "info" | "warning" | "destructive" {
  switch (p) {
    case "URGENT":
      return "destructive";
    case "HIGH":
      return "warning";
    case "MEDIUM":
      return "info";
    default:
      return "default";
  }
}

function statusTone(s: string): "default" | "info" | "warning" | "destructive" | "success" {
  switch (s) {
    case "APPROVED":
    case "PAID":
    case "COMPLETED":
      return "success";
    case "REJECTED":
    case "EXPIRED":
    case "CANCELLED":
    case "REFUSED":
    case "WITHDRAWN":
      return "destructive";
    case "UPLOADED":
    case "UNDER_REVIEW":
    case "SUBMITTED":
    case "IN_PROGRESS":
    case "BIOMETRICS":
    case "INTERVIEW":
    case "PROCESSING":
      return "info";
    case "REQUESTED":
    case "TODO":
    case "DRAFT":
    case "PENDING":
      return "warning";
    default:
      return "default";
  }
}

// ── Sub-components ─────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  badge,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <span className="text-primary" aria-hidden>
            {icon}
          </span>
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {badge}
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Internal navigation button — uses next/navigation's useRouter so the
 * lint rule about window.location.assign is satisfied and we get the
 * client-side transition (no full page reload).
 */
function NavButton({
  href,
  children,
  variant = "outline",
  size = "sm",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive" | "subtle";
  size?: "default" | "sm" | "icon" | "lg";
}) {
  const router = useRouter();
  return (
    <Button variant={variant} size={size} onClick={() => router.push(href)}>
      {children}
    </Button>
  );
}

function DetailRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-sm font-medium">
        {value || <span className="text-muted-foreground/70">—</span>}
        {hint && <span className="block text-[10px] font-normal text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────

export function OverviewCard({ app }: { app: AppView }) {
  return (
    <SectionCard
      icon={<MapPin className="h-4 w-4" aria-hidden />}
      title="Overview"
      badge={<Badge tone={app.status === "ACTIVE" ? "info" : "default"}>{app.status}</Badge>}
    >
      <dl className="divide-y divide-border">
        <DetailRow label="Application #" value={<span className="font-mono">{app.applicationNumber}</span>} />
        <DetailRow label="Destination" value={
          <span className="inline-flex items-center gap-1">
            {app.country?.flag && <span aria-hidden>{app.country.flag}</span>}
            {app.country?.name ?? "—"}
          </span>
        } />
        <DetailRow label="Current Stage" value={app.stageLabel} />
        <DetailRow label="Priority" value={<Badge tone={priorityTone(app.priority)}>{app.priority}</Badge>} />
        <DetailRow label="Last Updated" value={fmtDateTime(app.lastUpdated)} />
        <DetailRow label="Created" value={fmtDate(app.createdAt)} />
      </dl>
    </SectionCard>
  );
}

export function UniversityCard({ app }: { app: AppView }) {
  if (!app.university) {
    return (
      <SectionCard icon={<UniversityIcon className="h-4 w-4" aria-hidden />} title="University">
        <p className="text-sm text-muted-foreground">University not yet selected.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      icon={<UniversityIcon className="h-4 w-4" aria-hidden />}
      title="University"
      action={
        app.university.website ? (
          <Button size="sm" variant="ghost" onClick={() => window.open(app.university!.website!, "_blank", "noopener,noreferrer")}>
            Visit
          </Button>
        ) : null
      }
    >
      <dl className="divide-y divide-border">
        <DetailRow label="Name" value={app.university.name} />
        {app.university.city && <DetailRow label="City" value={app.university.city} />}
        {app.university.ranking != null && (
          <DetailRow label="Ranking" value={`#${app.university.ranking}`} />
        )}
      </dl>
    </SectionCard>
  );
}

export function CourseCard({ app }: { app: AppView }) {
  if (!app.course) {
    return (
      <SectionCard icon={<GraduationCap className="h-4 w-4" aria-hidden />} title="Course">
        <p className="text-sm text-muted-foreground">Course not yet selected.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard icon={<GraduationCap className="h-4 w-4" aria-hidden />} title="Course">
      <dl className="divide-y divide-border">
        <DetailRow label="Name" value={app.course.name} />
        <DetailRow label="Degree Level" value={app.course.degreeLevel} />
        {app.course.duration && <DetailRow label="Duration" value={app.course.duration} />}
        {app.course.tuitionFee != null && (
          <DetailRow
            label="Tuition"
            value={`${app.course.currency ?? "USD"} ${app.course.tuitionFee.toLocaleString()}`}
          />
        )}
      </dl>
    </SectionCard>
  );
}

export function IntakeCard({ app }: { app: AppView }) {
  if (!app.intake) {
    return (
      <SectionCard icon={<CalendarClock className="h-4 w-4" aria-hidden />} title="Intake">
        <p className="text-sm text-muted-foreground">Intake not yet selected.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard icon={<CalendarClock className="h-4 w-4" aria-hidden />} title="Intake">
      <dl className="divide-y divide-border">
        <DetailRow label="Intake" value={app.intake.name} />
        <DetailRow label="Deadline" value={fmtDate(app.intake.deadline)} />
      </dl>
    </SectionCard>
  );
}

export function StatusCard({ app }: { app: AppView }) {
  return (
    <SectionCard icon={<IdCard className="h-4 w-4" aria-hidden />} title="Application Status">
      <div className="space-y-2">
        <DetailRow label="Current Stage" value={app.stageLabel} />
        <DetailRow label="Status" value={<Badge tone={statusTone(app.status)}>{app.status}</Badge>} />
        <DetailRow label="Submission Date" value={fmtDate(app.submissionDate)} />
        <DetailRow label="Decision Date" value={fmtDate(app.decisionDate)} />
      </div>
    </SectionCard>
  );
}

export function DatesCard({ app }: { app: AppView }) {
  if (app.importantDates.length === 0) {
    return (
      <SectionCard icon={<CalendarClock className="h-4 w-4" aria-hidden />} title="Important Dates">
        <p className="text-sm text-muted-foreground">No important dates yet.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard icon={<CalendarClock className="h-4 w-4" aria-hidden />} title="Important Dates">
      <ul className="space-y-2">
        {app.importantDates.map((d, i) => {
          // Visual treatment is purely cosmetic — color depends on
          // whether the date is in the past or future. We don't call
          // Date.now() during render (it's flagged by the purity rule);
          // instead, we just style by kind (visa/payment are usually
          // "interesting" in either direction).
          const toneCls =
            d.kind === "visa" || d.kind === "payment"
              ? "border-info/30 bg-info/5"
              : "border-border bg-card";
          return (
            <li
              key={`${d.kind}-${i}`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
                toneCls,
              )}
            >
              <span className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {d.label}
              </span>
              <span className="text-sm font-medium text-foreground">
                {fmtDate(d.date)}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export function CounselorCard({ app }: { app: AppView }) {
  if (!app.counselor) {
    return (
      <SectionCard icon={<UserRound className="h-4 w-4" aria-hidden />} title="Counselor">
        <p className="text-sm text-muted-foreground">No counselor assigned yet.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      icon={<UserRound className="h-4 w-4" aria-hidden />}
      title="Counselor"
      action={
        <NavButton href="/student/messages">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Message
        </NavButton>
      }
    >
      <dl className="divide-y divide-border">
        <DetailRow label="Name" value={app.counselor.name} />
        {app.counselor.designation && (
          <DetailRow label="Designation" value={app.counselor.designation} />
        )}
        <DetailRow
          label="Email"
          value={
            <a href={`mailto:${app.counselor.email}`} className="text-primary hover:underline">
              {app.counselor.email}
            </a>
          }
        />
      </dl>
    </SectionCard>
  );
}

export function DocumentsCard({ app }: { app: AppView }) {
  const counts = app.documents.counts;
  return (
    <SectionCard
      icon={<FileText className="h-4 w-4" aria-hidden />}
      title="Documents"
      badge={<Badge tone="info">{counts.required}</Badge>}
      action={
        <NavButton href="/student/documents">
          Manage
        </NavButton>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <DocCountTile label="Approved" value={counts.approved} tone="success" />
        <DocCountTile label="Pending" value={counts.pending} tone="warning" />
        <DocCountTile label="In Review" value={counts.underReview} tone="info" />
        <DocCountTile label="Rejected" value={counts.rejected} tone="destructive" />
      </div>
      {app.documents.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {app.documents.items.slice(0, 5).map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">{d.fileName}</p>
              </div>
              <Badge tone={statusTone(d.status)}>{d.status}</Badge>
            </li>
          ))}
          {app.documents.items.length > 5 && (
            <li className="pt-1 text-center text-xs text-muted-foreground">
              +{app.documents.items.length - 5} more documents
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  );
}

function DocCountTile({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "info" | "destructive" }) {
  const cls = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-md p-2 text-center", cls)}>
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide">{label}</p>
    </div>
  );
}

export function TasksCard({ app }: { app: AppView }) {
  if (app.tasks.items.length === 0) {
    return (
      <SectionCard icon={<ClipboardList className="h-4 w-4" aria-hidden />} title="Tasks">
        <p className="text-sm text-muted-foreground">No tasks assigned.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      icon={<ClipboardList className="h-4 w-4" aria-hidden />}
      title="Tasks"
      badge={<Badge tone={app.tasks.open > 0 ? "warning" : "success"}>{app.tasks.open} open</Badge>}
      action={
        <NavButton href="/student/tasks">
          View All
        </NavButton>
      }
    >
      <ul className="space-y-1.5">
        {app.tasks.items.slice(0, 5).map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.title}</p>
              {t.dueDate && (
                <p className="text-xs text-muted-foreground">Due: {fmtDate(t.dueDate)}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
              <Badge tone={statusTone(t.status)}>{t.status}</Badge>
            </div>
          </li>
        ))}
        {app.tasks.items.length > 5 && (
          <li className="pt-1 text-center text-xs text-muted-foreground">
            +{app.tasks.items.length - 5} more tasks
          </li>
        )}
      </ul>
    </SectionCard>
  );
}

export function PaymentsCard({ app }: { app: AppView }) {
  const totals = app.payments.totals;
  return (
    <SectionCard
      icon={<CreditCard className="h-4 w-4" aria-hidden />}
      title="Payments"
      badge={totals.due > 0 ? <Badge tone="warning">{totals.due.toLocaleString()} due</Badge> : <Badge tone="success">Paid</Badge>}
      action={
        <NavButton href="/student/payments">
          View
        </NavButton>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <PaymentTile label="Total" value={totals.invoiceTotal.toLocaleString()} />
        <PaymentTile label="Paid" value={totals.paid.toLocaleString()} tone="success" />
        <PaymentTile label="Due" value={totals.due.toLocaleString()} tone={totals.due > 0 ? "warning" : "default"} />
      </div>
      {app.payments.nextOpenInvoice && (
        <div className="mb-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
          <p className="font-medium text-warning">Next payment due</p>
          <p className="text-muted-foreground">
            {app.payments.nextOpenInvoice.invoiceNumber} — {app.payments.nextOpenInvoice.dueAmount.toLocaleString()} due {fmtDate(app.payments.nextOpenInvoice.dueDate)}
          </p>
        </div>
      )}
      {app.payments.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {app.payments.items.slice(0, 3).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {p.currency} {p.amount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.paymentMethod} · {fmtDate(p.paymentDate)}
                </p>
              </div>
              <Badge tone={statusTone(p.status)}>{p.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function PaymentTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" }) {
  const cls = {
    default: "bg-muted text-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  }[tone];
  return (
    <div className={cn("rounded-md p-2", cls)}>
      <p className="text-sm font-semibold leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">{label}</p>
    </div>
  );
}

export function VisaCard({ app }: { app: AppView }) {
  if (!app.visa) {
    return (
      <SectionCard icon={<Stamp className="h-4 w-4" aria-hidden />} title="Visa">
        <p className="text-sm text-muted-foreground">
          Visa tracking begins once your application reaches the Visa Preparation stage.
        </p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      icon={<Stamp className="h-4 w-4" aria-hidden />}
      title="Visa"
      badge={<Badge tone={statusTone(app.visa.stage)}>{app.visa.stageLabel}</Badge>}
      action={
        <NavButton href="/student/visa">
          Details
        </NavButton>
      }
    >
      <dl className="divide-y divide-border">
        {app.visa.visaType && <DetailRow label="Visa Type" value={app.visa.visaType} />}
        <DetailRow label="Submitted" value={fmtDate(app.visa.submittedAt)} />
        <DetailRow label="Biometrics" value={fmtDate(app.visa.biometricsAt)} />
        <DetailRow label="Interview" value={fmtDate(app.visa.interviewAt)} />
        <DetailRow label="Decision" value={fmtDate(app.visa.decisionAt)} />
      </dl>
    </SectionCard>
  );
}

export function TimelineCard({ app }: { app: AppView }) {
  if (app.timeline.length === 0) {
    return (
      <SectionCard icon={<Receipt className="h-4 w-4" aria-hidden />} title="Timeline">
        <p className="text-sm text-muted-foreground">No history yet.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard icon={<Receipt className="h-4 w-4" aria-hidden />} title="Timeline">
      <ol className="relative space-y-3 border-l border-border pl-4">
        {app.timeline.map((h) => (
          <li key={h.id} className="relative">
            <span
              aria-hidden
              className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card"
            />
            <p className="text-sm font-medium">
              {h.fromStage ? `${h.fromLabel} → ${h.toLabel}` : h.toLabel}
            </p>
            {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
            <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDateTime(h.createdAt)}</p>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

export function NotesCard({ app }: { app: AppView }) {
  if (app.notes.length === 0) {
    return null; // Don't render an empty notes card.
  }
  return (
    <SectionCard icon={<Mail className="h-4 w-4" aria-hidden />} title="Notes from your counselor">
      <ul className="space-y-2">
        {app.notes.map((n) => (
          <li
            key={n.id}
            className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
          >
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(n.createdAt)}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/** Next-action sticky banner — rendered at the top of the page. */
export function NextActionBanner({ app }: { app: AppView }) {
  const action = app.nextAction;
  const toneCls =
    action.priority === "HIGH"
      ? "border-warning/40 bg-warning/10"
      : action.priority === "MEDIUM"
        ? "border-info/40 bg-info/10"
        : "border-border bg-muted/30";
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg border p-3", toneCls)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{action.title}</p>
        <p className="text-xs text-muted-foreground">{action.reason}</p>
      </div>
      <NavButton
        href={action.ctaHref}
        size="sm"
        variant={action.priority === "HIGH" ? "default" : "outline"}
      >
        {action.ctaLabel}
      </NavButton>
    </div>
  );
}

export type { AppView };
