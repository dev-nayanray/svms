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
import {
  MobilePage,
  ProgressCard,
  QuickAction,
  Timeline,
  MobileCard,
  StudentSection,
  StudentStatCard,
  StudentEmptyState,
  StatusBadge,
} from "@/components/student/ui";
import { TodayAgenda } from "@/components/student/dashboard/today-agenda";
import { ProfileCompletionCard } from "@/components/student/dashboard/profile-completion-card";
import { PremiumGreetingCard } from "@/components/student/dashboard/premium-greeting-card";
import { formatDate, formatMoney, titleCase, cn } from "@/lib/utils";
import {
  getStudentDashboard,
} from "@/lib/services/student-dashboard";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const { userId, student } = await requireStudentProfile();

  // Single optimized aggregate — all queries run in parallel
  const data = await getStudentDashboard(student, userId);

  const {
    application,
    stages,
    progress,
    nextAction,
    todayAgenda,
    profileCompletion,
    documents: docSummary,
    deadlines,
    payments: paymentSummary,
    counselor,
    activities,
    notifications,
  } = data;

  return (
    <MobilePage>
      {/* ──────────────────────────────────────────────────────
       * GROUP 1 — TODAY
       * Hero greeting + what's happening today + profile nudge
       * ────────────────────────────────────────────────────── */}
      <div className="stagger-children space-y-5">
        {/* 1a. Premium greeting card with quick stats */}
        <PremiumGreetingCard
          student={student}
          application={application ? {
            country: application.country,
            course: application.course,
            stageKey: application.stageKey,
          } : null}
          progress={progress}
          docSummary={docSummary}
          unreadCount={notifications.filter((n) => !n.readAt).length}
          notifications={notifications}
        />

        {/* 1b. Today's agenda — appointments + tasks due today */}
        <TodayAgenda data={todayAgenda} />

        {/* 1c. Profile completion nudge — hidden when 100% */}
        <ProfileCompletionCard completion={profileCompletion} />

        {/* 1d. Next action — high-priority CTA */}
        {nextAction && (
          <MobileCard className={cn(
            "border-l-4 p-4",
            nextAction.priority === "HIGH"
              ? "border-l-destructive bg-destructive/5"
              : nextAction.priority === "MEDIUM"
                ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10"
                : "border-l-info bg-info/5",
          )}>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                  nextAction.priority === "HIGH"
                    ? "bg-destructive/10 text-destructive"
                    : nextAction.priority === "MEDIUM"
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-info/10 text-info",
                )}
              >
                {nextAction.priority === "HIGH" ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Next step
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-snug">{nextAction.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{nextAction.reason}</p>
                {nextAction.deadline && (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    Due {formatDate(nextAction.deadline)}
                  </p>
                )}
              </div>
            </div>
            <Link
              href={nextAction.ctaHref}
              className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-amber-700 hover:shadow-md active:scale-95"
            >
              {nextAction.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </MobileCard>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────
       * GROUP 2 — PROGRESS
       * Application + timeline + documents + deadlines
       * ────────────────────────────────────────────────────── */}
      <div className="stagger-children space-y-5">
        {/* Group header */}
        <div className="flex items-center gap-2 px-1">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <h2 className="text-sm font-bold tracking-tight text-foreground">Progress</h2>
        </div>

        {/* 2a. Application progress card */}
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
                  className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-amber-600 transition-colors hover:text-amber-700"
                >
                  View application <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            }
          />
        ) : (
          <StudentEmptyState
            icon={<FolderKanban className="h-5 w-5" aria-hidden />}
            title="No application yet"
            description="Your counselor is preparing your application. Explore universities in the meantime."
            action={
              <Link
                href="/student/universities"
                className="inline-flex min-h-[36px] items-center text-xs font-semibold text-amber-600 transition-colors hover:text-amber-700"
              >
                Browse universities →
              </Link>
            }
          />
        )}

        {/* 2b. Application timeline */}
        {application && stages.length > 0 && (
          <MobileCard>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Application timeline
            </p>
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
        )}

        {/* 2c. Document summary — unified stat grid */}
        <StudentSection
          label="Documents"
          viewAllHref="/student/documents"
          bodyClassName="grid grid-cols-5 gap-2"
        >
          <StudentStatCard
            icon={<FileText className="h-4 w-4" aria-hidden />}
            value={docSummary.required}
            label="Required"
          />
          <StudentStatCard
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
            value={docSummary.approved}
            label="Approved"
            tone="success"
          />
          <StudentStatCard
            icon={<Clock className="h-4 w-4" aria-hidden />}
            value={docSummary.underReview}
            label="Review"
            tone="info"
          />
          <StudentStatCard
            icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
            value={docSummary.rejected}
            label="Rejected"
            tone="destructive"
          />
          <StudentStatCard
            icon={<FileUp className="h-4 w-4" aria-hidden />}
            value={docSummary.pending}
            label="Pending"
            tone="warning"
          />
        </StudentSection>

        {/* 2d. Upcoming deadlines */}
        {deadlines.length > 0 && (
          <StudentSection
            label="Upcoming deadlines"
            bodyClassName="space-y-2"
          >
            {deadlines.slice(0, 3).map((d, i) => (
              <MobileCard
                key={i}
                as="link"
                href={d.href}
                className="flex items-center gap-3 p-3"
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    d.overdue
                      ? "bg-red-500/10 text-red-600"
                      : d.kind === "PAYMENT"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-blue-500/10 text-blue-600",
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
                      d.overdue ? "font-medium text-red-600" : "text-muted-foreground",
                    )}
                  >
                    {d.overdue ? "Overdue · " : "Due "}
                    {formatDate(d.dueDate)}
                  </p>
                </div>
              </MobileCard>
            ))}
          </StudentSection>
        )}

        {/* 2e. Payment summary */}
        {paymentSummary.totalAmount > 0 && (
          <StudentSection
            label="Payment summary"
            viewAllHref="/student/invoices"
            viewAllLabel="View details"
          >
            <MobileCard className="p-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                  <p className="mt-0.5 text-sm font-bold">{formatMoney(paymentSummary.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Paid</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-600">{formatMoney(paymentSummary.paid)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Remaining</p>
                  <p className="mt-0.5 text-sm font-bold text-amber-600">{formatMoney(paymentSummary.remaining)}</p>
                </div>
              </div>
              {paymentSummary.nextPayment && (
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">
                    Next: {paymentSummary.nextPayment.invoiceNumber}
                  </span>
                  <span className="text-xs font-medium text-amber-600">
                    {formatMoney(paymentSummary.nextPayment.amount)}
                  </span>
                </div>
              )}
            </MobileCard>
          </StudentSection>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────
       * GROUP 3 — QUICK ACCESS
       * Shortcuts + counselor + activity + notifications
       * ────────────────────────────────────────────────────── */}
      <div className="stagger-children space-y-5">
        {/* Group header */}
        <div className="flex items-center gap-2 px-1">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <h2 className="text-sm font-bold tracking-tight text-foreground">Quick access</h2>
        </div>

        {/* 3a. Quick actions grid */}
        <section aria-labelledby="quick-actions">
          <h3 id="quick-actions" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Shortcuts
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

        {/* 3b. Counselor card */}
        {counselor && (
          <StudentSection label="Your counselor">
            <MobileCard className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-sm font-bold text-amber-700">
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
                    className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground active:scale-95"
                    aria-label="Email counselor"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                  </a>
                )}
                <Link
                  href="/student/notifications"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm transition-all hover:shadow-md active:scale-95"
                  aria-label="Message counselor"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </MobileCard>
          </StudentSection>
        )}

        {/* 3c. Recent activity */}
        {activities.length > 0 && (
          <StudentSection label="Recent activity">
            <MobileCard className="divide-y divide-border p-0">
              {activities.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    {a.title.includes("approved") ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    ) : a.title.includes("Payment") ? (
                      <DollarSign className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    ) : a.title.includes("Message") ? (
                      <MessageSquare className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                    ) : (
                      <TrendingUp className="h-3.5 w-3.5 text-amber-600" aria-hidden />
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
          </StudentSection>
        )}

        {/* 3d. Notifications preview */}
        {notifications.length > 0 && (
          <StudentSection
            label="Latest notifications"
            viewAllHref="/student/notifications"
            viewAllLabel="See all"
          >
            {notifications.slice(0, 3).map((n) => (
              <MobileCard
                key={n.id}
                as="link"
                href={n.link ?? "/student/notifications"}
                className="flex items-start gap-3 p-3"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600">
                  <Bell className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                </div>
                {!n.readAt && <StatusBadge tone="info">New</StatusBadge>}
              </MobileCard>
            ))}
          </StudentSection>
        )}
      </div>

      {/* Application completed / visa refused / visa approved states */}
      {application?.status === "COMPLETED" && (
        <MobileCard className="border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/10">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Application completed!</p>
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
