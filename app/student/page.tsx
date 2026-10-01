import Link from "next/link";
import {
  FileUp,
  FolderKanban,
  CreditCard,
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { requireStudentProfile } from "@/lib/student/guard";
import { Badge } from "@/components/ui";
import { MobilePage, QuickAction, MobileCard } from "@/components/student/ui";
import { TodayAgenda } from "@/components/student/dashboard/today-agenda";
import { PremiumGreetingCard } from "@/components/student/dashboard/premium-greeting-card";
import { formatDate, cn } from "@/lib/utils";
import { getStudentDashboard } from "@/lib/services/student-dashboard";

export const dynamic = "force-dynamic";

/**
 * Student Home — simplified dashboard.
 *
 * Design principles:
 *  - 5 clear sections, not 12
 *  - Progressive disclosure — details are one tap away
 *  - The primary action is always obvious
 *  - Human-friendly language, not technical jargon
 *
 * Sections:
 *   1. Welcome + quick stats (greeting card)
 *   2. Next step (the ONE thing to do next)
 *   3. Today's schedule (appointments + tasks due today)
 *   4. Quick actions (4 most common tasks)
 *   5. Recent notifications (3 latest)
 */
export default async function StudentDashboard() {
  const { userId, student } = await requireStudentProfile();
  const data = await getStudentDashboard(student, userId);

  const {
    application,
    progress,
    nextAction,
    todayAgenda,
    notifications,
  } = data;

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const recentNotifications = notifications.slice(0, 3);

  return (
    <MobilePage>
      {/* ─── 1. WELCOME + QUICK STATS ─── */}
      <PremiumGreetingCard
        student={student}
        application={application ? {
          country: application.country,
          course: application.course,
          stageKey: application.stageKey,
        } : null}
        progress={progress}
        docSummary={data.documents}
        unreadCount={unreadCount}
        notifications={notifications}
      />

      {/* ─── 2. NEXT STEP — the ONE thing to do next ─── */}
      {nextAction ? (
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
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {nextAction.ctaLabel}
          </Link>
        </MobileCard>
      ) : (
        <MobileCard className="border-success/30 bg-success/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-success">You&apos;re all caught up!</p>
              <p className="text-xs text-muted-foreground">
                No pending tasks right now. We&apos;ll notify you when there&apos;s something to do.
              </p>
            </div>
          </div>
        </MobileCard>
      )}

      {/* ─── 3. TODAY'S SCHEDULE ─── */}
      <TodayAgenda data={todayAgenda} />

      {/* ─── 4. QUICK ACTIONS ─── */}
      <section aria-labelledby="quick-actions">
        <h3 id="quick-actions" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            label="My Application"
            description="Status & timeline"
          />
          <QuickAction
            href="/student/messages"
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            label="Message Counselor"
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

      {/* ─── 5. RECENT NOTIFICATIONS ─── */}
      {recentNotifications.length > 0 && (
        <section aria-labelledby="notif-heading">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="notif-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent updates
            </h3>
            <Link href="/student/notifications" className="text-xs font-semibold text-primary">
              See all →
            </Link>
          </div>
          <div className="space-y-2">
            {recentNotifications.map((n) => (
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

      {/* Application completed state */}
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
