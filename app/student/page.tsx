import Link from "next/link";
import { FileUp, FolderKanban, MessageSquare, CreditCard, ArrowRight, CalendarClock, Bell } from "lucide-react";
import { requireStudentProfile } from "@/lib/student/guard";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui";
import { StatusBadge } from "@/components/shared";
import { MobilePage, ProgressCard, QuickAction, Timeline, MobileCard } from "@/components/student/ui";
import { formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function StudentHome() {
  const { userId, student } = await requireStudentProfile();

  const [applications, pendingDocs, nextTask, notifications, stages] = await Promise.all([
    prisma.application.findMany({
      where: { studentId: student.id, deletedAt: null },
      include: { country: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    prisma.document.findMany({
      where: { studentId: student.id, deletedAt: null, status: { in: ["REQUESTED", "REJECTED"] } },
      orderBy: { createdAt: "asc" },
      take: 1,
    }),
    prisma.task.findFirst({
      where: { studentId: student.id, deletedAt: null, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gte: new Date() } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.applicationStage.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const mainApp = applications[0];
  const currentIdx = stages.findIndex((s) => s.key === mainApp?.stageKey);
  const percent = mainApp && currentIdx >= 0 ? Math.round(((currentIdx + 1) / stages.length) * 100) : 0;

  const nextAction = pendingDocs[0]
    ? { label: `Upload: ${pendingDocs[0].name}`, href: "/student/documents" }
    : nextTask
      ? { label: nextTask.title, href: "/student/tasks" }
      : null;

  return (
    <MobilePage>
      {/* Greeting */}
      <section aria-labelledby="greeting">
        <h2 id="greeting" className="text-xl font-semibold">
          {greeting()}, {student.firstName} 👋
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {student.studentId}
          {mainApp?.country?.name ? ` · Applying to ${mainApp.country.name}` : ""}
        </p>
      </section>

      {/* Application status */}
      {mainApp ? (
        <ProgressCard
          title={`Your visa application is currently in ${titleCase(mainApp.stageKey.replace(/_/g, " ").toLowerCase())}`}
          subtitle={`${mainApp.applicationNumber} · ${mainApp.country.name}`}
          percent={percent}
          footer={
            <Link
              href="/student/applications"
              className="inline-flex min-h-[36px] items-center gap-1 font-medium text-primary"
            >
              View application <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />
      ) : (
        <MobileCard>
          <p className="text-sm font-medium">No application yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your counselor is preparing your application. Explore universities in the meantime.
          </p>
          <Link href="/student/universities" className="mt-2 inline-flex min-h-[36px] items-center text-sm font-medium text-primary">
            Browse universities
          </Link>
        </MobileCard>
      )}

      {/* Next action + upcoming deadline */}
      <div className="grid gap-3 sm:grid-cols-2">
        {nextAction && (
          <MobileCard as="link" href={nextAction.href} className="border-primary/40">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Next important action</p>
            <p className="mt-1 text-sm font-semibold leading-snug">{nextAction.label}</p>
          </MobileCard>
        )}
        {nextTask?.dueDate && (
          <MobileCard as="link" href="/student/tasks">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming deadline</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold leading-snug">
              <CalendarClock className="h-4 w-4 text-warning" aria-hidden />
              {nextTask.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Due {formatDate(nextTask.dueDate)}</p>
          </MobileCard>
        )}
      </div>

      {/* Quick actions */}
      <section aria-labelledby="quick-actions">
        <h3 id="quick-actions" className="text-sm font-semibold text-muted-foreground">
          Quick actions
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            href="/student/messages"
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            label="Contact Counselor"
            description="Ask a question"
          />
          <QuickAction
            href="/student/payments"
            icon={<CreditCard className="h-4 w-4" aria-hidden />}
            label="Make Payment"
            description="Invoices & dues"
          />
        </div>
      </section>

      {/* Recent notifications */}
      {notifications.length > 0 && (
        <section aria-labelledby="recent-notifications">
          <div className="flex items-center justify-between">
            <h3 id="recent-notifications" className="text-sm font-semibold text-muted-foreground">
              Latest updates
            </h3>
            <Link href="/student/notifications" className="flex min-h-[36px] items-center text-sm font-medium text-primary">
              See all
            </Link>
          </div>
          <ul className="mt-2 space-y-2">
            {notifications.map((n) => (
              <li key={n.id}>
                <MobileCard as="link" href={n.link ?? "/student/notifications"} className="flex items-start gap-3 p-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Bell className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                  </div>
                  <Badge tone="info">New</Badge>
                </MobileCard>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Stage timeline (desktop; mobile keeps the home screen lean) */}
      {mainApp && currentIdx >= 0 && (
        <section aria-labelledby="timeline-heading" className="hidden md:block">
          <h3 id="timeline-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
            Application timeline
          </h3>
          <MobileCard>
            <Timeline
              steps={stages.map((s, i) => ({
                label: titleCase(s.name.replace(/_/g, " ").toLowerCase()),
                state: i < currentIdx ? "done" : i === currentIdx ? "current" : "pending",
              }))}
            />
            <div className="mt-3 border-t border-border pt-3">
              <StatusBadge status={mainApp.status} />
            </div>
          </MobileCard>
        </section>
      )}
    </MobilePage>
  );
}
