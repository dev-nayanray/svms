import Link from "next/link";
import {
  FileUp,
  FolderKanban,
  MessageSquare,
  CreditCard,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Mail,
  FileText,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { requireStudentProfile } from "@/lib/student/guard";
import { Badge } from "@/components/ui";
import {
  MobilePage,
  ProgressCard,
  QuickAction,
  Timeline,
  MobileCard,
} from "@/components/student/ui";
import { formatDate, formatMoney, titleCase, cn } from "@/lib/utils";
import {
  getStudentDashboard,
} from "@/lib/services/student-dashboard";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function StudentDashboard() {
  const { userId, student } = await requireStudentProfile();

  // Single optimized aggregate — all queries run in parallel
  const data = await getStudentDashboard(student, userId);

  const {
    application,
    stages,
    progress,
    nextAction,
    documents: docSummary,
    deadlines,
    payments: paymentSummary,
    counselor,
    activities,
    notifications,
  } = data;

  return (
    <MobilePage>
      {/* ─── 1. HEADER ─── */}
      <section aria-labelledby="greeting" className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h2 id="greeting" className="text-xl font-bold">
            {student.firstName} {student.lastName}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {student.studentId}
            {application?.country ? ` · ${application.country}` : ""}
          </p>
        </div>
        <Link
          href="/student/notifications"
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {notifications.filter((n) => !n.readAt).length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {notifications.filter((n) => !n.readAt).length > 9 ? "9+" : notifications.filter((n) => !n.readAt).length}
            </span>
          )}
        </Link>
      </section>

      {/* ─── 2. APPLICATION PROGRESS CARD ─── */}
      {application ? (
        <ProgressCard
          title={`${application.country} — ${application.course ?? "Application"}`}
          subtitle={`${application.number} · ${application.university ?? ""}`}
          percent={progress}
          footer={
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {titleCase(application.stageKey.replace(/_/g, " ").toLowerCase())}
              </span>
              <Link
                href={`/student/applications/${application.id}`}
                className="inline-flex min-h-[36px] items-center gap-1 text-sm font-medium text-primary"
              >
                View application <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          }
        />
      ) : (
        <MobileCard>
          <p className="text-sm font-medium">No application yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your counselor is preparing your application. Explore universities in the meantime.
          </p>
          <Link
            href="/student/universities"
            className="mt-2 inline-flex min-h-[36px] items-center text-sm font-medium text-primary"
          >
            Browse universities →
          </Link>
        </MobileCard>
      )}

      {/* ─── 3. NEXT ACTION ─── */}
      {nextAction && (
        <MobileCard className="border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                nextAction.priority === "HIGH"
                  ? "bg-destructive/10 text-destructive"
                  : nextAction.priority === "MEDIUM"
                    ? "bg-warning/10 text-warning"
                    : "bg-primary/10 text-primary",
              )}
            >
              {nextAction.priority === "HIGH" ? (
                <AlertTriangle className="h-4 w-4" aria-hidden />
              ) : (
                <Clock className="h-4 w-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next step
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug">{nextAction.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{nextAction.reason}</p>
              {nextAction.deadline && (
                <p className="mt-1 text-xs font-medium text-warning">
                  Due {formatDate(nextAction.deadline)}
                </p>
              )}
            </div>
          </div>
          <Link
            href={nextAction.ctaHref}
            className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {nextAction.ctaLabel}
          </Link>
        </MobileCard>
      )}

      {/* ─── 4. APPLICATION TIMELINE ─── */}
      {application && stages.length > 0 && (
        <section aria-labelledby="timeline-heading">
          <h3 id="timeline-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
            Application timeline
          </h3>
          <MobileCard>
            <Timeline
              steps={stages.map((s, i) => {
                const currentIdx = stages.findIndex((st) => st.key === application.stageKey);
                return {
                  label: titleCase(s.name.replace(/_/g, " ").toLowerCase()),
                  state:
                    i < currentIdx ? "done" as const : i === currentIdx ? "current" as const : "pending" as const,
                };
              })}
            />
          </MobileCard>
        </section>
      )}

      {/* ─── 5. DOCUMENT SUMMARY ─── */}
      <section aria-labelledby="docs-heading">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="docs-heading" className="text-sm font-semibold text-muted-foreground">
            Documents
          </h3>
          <Link
            href="/student/documents"
            className="text-xs font-medium text-primary"
          >
            View all →
          </Link>
        </div>
        <MobileCard className="p-3">
          <div className="grid grid-cols-5 gap-2 text-center">
            <div>
              <p className="text-lg font-bold">{docSummary.required}</p>
              <p className="text-[10px] text-muted-foreground">Required</p>
            </div>
            <div>
              <p className="text-lg font-bold text-success">{docSummary.approved}</p>
              <p className="text-[10px] text-muted-foreground">Approved</p>
            </div>
            <div>
              <p className="text-lg font-bold text-info">{docSummary.underReview}</p>
              <p className="text-[10px] text-muted-foreground">Review</p>
            </div>
            <div>
              <p className="text-lg font-bold text-destructive">{docSummary.rejected}</p>
              <p className="text-[10px] text-muted-foreground">Rejected</p>
            </div>
            <div>
              <p className="text-lg font-bold text-warning">{docSummary.pending}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
          </div>
        </MobileCard>
      </section>

      {/* ─── 6. UPCOMING DEADLINES ─── */}
      {deadlines.length > 0 && (
        <section aria-labelledby="deadlines-heading">
          <h3 id="deadlines-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
            Upcoming deadlines
          </h3>
          <div className="space-y-2">
            {deadlines.slice(0, 3).map((d, i) => (
              <MobileCard key={i} as="link" href={d.href} className="flex items-center gap-3 p-3">
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    d.overdue
                      ? "bg-destructive/10 text-destructive"
                      : d.kind === "PAYMENT"
                        ? "bg-warning/10 text-warning"
                        : "bg-info/10 text-info",
                  )}
                >
                  {d.overdue ? (
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                  ) : d.kind === "PAYMENT" ? (
                    <DollarSign className="h-4 w-4" aria-hidden />
                  ) : (
                    <FileText className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p
                    className={cn(
                      "text-xs",
                      d.overdue ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {d.overdue ? "Overdue · " : "Due "}
                    {formatDate(d.dueDate)}
                  </p>
                </div>
              </MobileCard>
            ))}
          </div>
        </section>
      )}

      {/* ─── 7. PAYMENT SUMMARY ─── */}
      {paymentSummary.totalAmount > 0 && (
        <section aria-labelledby="payments-heading">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="payments-heading" className="text-sm font-semibold text-muted-foreground">
              Payment summary
            </h3>
            <Link href="/student/invoices" className="text-xs font-medium text-primary">
              View details →
            </Link>
          </div>
          <MobileCard className="p-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                <p className="mt-0.5 text-sm font-bold">{formatMoney(paymentSummary.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Paid</p>
                <p className="mt-0.5 text-sm font-bold text-success">{formatMoney(paymentSummary.paid)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Remaining</p>
                <p className="mt-0.5 text-sm font-bold text-warning">{formatMoney(paymentSummary.remaining)}</p>
              </div>
            </div>
            {paymentSummary.nextPayment && (
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-xs text-muted-foreground">
                  Next: {paymentSummary.nextPayment.invoiceNumber}
                </span>
                <span className="text-xs font-medium text-warning">
                  {formatMoney(paymentSummary.nextPayment.amount)}
                </span>
              </div>
            )}
          </MobileCard>
        </section>
      )}

      {/* ─── 8. QUICK ACTIONS ─── */}
      <section aria-labelledby="quick-actions">
        <h3 id="quick-actions" className="mb-2 text-sm font-semibold text-muted-foreground">
          Quick actions
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction
            href="/student/documents"
            icon={<FileUp className="h-4 w-4" aria-hidden />}
            label="Upload Document"
            description="Requested files"
          />
          <QuickAction
            href="/student/applications"
            icon={<FolderKanban className="h-4 w-4" aria-hidden />}
            label="View Application"
            description="Status & timeline"
          />
          <QuickAction
            href="/student/notifications"
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            label="Contact Counselor"
            description="Ask a question"
          />
          <QuickAction
            href="/student/invoices"
            icon={<CreditCard className="h-4 w-4" aria-hidden />}
            label="Make Payment"
            description="Invoices & dues"
          />
        </div>
      </section>

      {/* ─── 9. COUNSELOR CARD ─── */}
      {counselor && (
        <section aria-labelledby="counselor-heading">
          <h3 id="counselor-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
            Your counselor
          </h3>
          <MobileCard className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {counselor.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{counselor.name}</p>
              <p className="text-xs text-muted-foreground">{counselor.designation ?? "Counselor"}</p>
            </div>
            <div className="flex gap-1.5">
              {counselor.email && (
                <a
                  href={`mailto:${counselor.email}`}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Email counselor"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                </a>
              )}
              <Link
                href="/student/notifications"
                className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"
                aria-label="Message counselor"
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </MobileCard>
        </section>
      )}

      {/* ─── 10. RECENT ACTIVITY ─── */}
      {activities.length > 0 && (
        <section aria-labelledby="activity-heading">
          <h3 id="activity-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
            Recent activity
          </h3>
          <MobileCard className="divide-y divide-border p-0">
            {activities.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  {a.title.includes("approved") ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                  ) : a.title.includes("Payment") ? (
                    <DollarSign className="h-3.5 w-3.5 text-success" aria-hidden />
                  ) : a.title.includes("Message") ? (
                    <MessageSquare className="h-3.5 w-3.5 text-info" aria-hidden />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatDate(a.createdAt)}
                </span>
              </div>
            ))}
          </MobileCard>
        </section>
      )}

      {/* ─── 11. NOTIFICATIONS PREVIEW ─── */}
      {notifications.length > 0 && (
        <section aria-labelledby="notif-heading">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="notif-heading" className="text-sm font-semibold text-muted-foreground">
              Latest notifications
            </h3>
            <Link href="/student/notifications" className="text-xs font-medium text-primary">
              See all →
            </Link>
          </div>
          <div className="space-y-2">
            {notifications.slice(0, 3).map((n) => (
              <MobileCard
                key={n.id}
                as="link"
                href={n.link ?? "/student/notifications"}
                className="flex items-start gap-3 p-3"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                </div>
                {!n.readAt && <Badge tone="info">New</Badge>}
              </MobileCard>
            ))}
          </div>
        </section>
      )}

      {/* Application completed / visa refused / visa approved states */}
      {application?.status === "COMPLETED" && (
        <MobileCard className="border-success/30 bg-success/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-success">Application completed!</p>
              <p className="text-xs text-muted-foreground">
                Congratulations — your visa journey is complete.
              </p>
            </div>
          </div>
        </MobileCard>
      )}
    </MobilePage>
  );
}
