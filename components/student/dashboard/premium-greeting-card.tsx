import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  FileText,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PremiumGreetingCard — the hero card at the top of the student
 * dashboard. Replaces the old flat white card with a gradient
 * background, larger avatar, and a quick-stats row showing the
 * most important numbers at a glance.
 *
 * Stats row shows:
 *  - Application progress % (with GraduationCap icon)
 *  - Approved documents count (with FileText icon)
 *  - Unread notifications count (with Bell icon)
 *
 * Each stat is tappable → links to the relevant page.
 *
 * Server component — pure presentation driven by props from
 * getStudentDashboard().
 */
export function PremiumGreetingCard({
  student,
  application,
  progress,
  docSummary,
  unreadCount,
  notifications,
}: {
  student: {
    firstName: string;
    lastName: string;
    studentId: string;
    profilePhotoUrl?: string | null;
  };
  application: {
    country: string;
    course: string | null;
    stageKey: string;
  } | null;
  progress: number;
  docSummary: {
    approved: number;
    required: number;
  };
  unreadCount: number;
  notifications: { readAt: Date | string | null }[];
}) {
  const initials = `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <section aria-labelledby="greeting">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border shadow-sm",
          // Premium gradient background — subtle, matches the header
          "bg-gradient-to-br from-primary/8 via-card to-info/8",
        )}
      >
        {/* ── Decorative gradient orb (top-right) ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-primary/15 to-info/10 blur-2xl"
        />

        {/* ── Content ── */}
        <div className="relative p-4">
          {/* Top row: avatar + greeting + bell */}
          <div className="flex items-center gap-4">
            {/* Profile image / initials — larger with gradient ring */}
            <Link href="/student/profile" aria-label="View profile" className="shrink-0">
              {student.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={student.profilePhotoUrl}
                  alt={student.firstName}
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-primary/20"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-info/20 text-xl font-bold text-primary ring-2 ring-primary/20">
                  {initials || "S"}
                </span>
              )}
            </Link>

            {/* Greeting text */}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">{greeting},</p>
              <h2 id="greeting" className="text-xl font-bold tracking-tight">
                {student.firstName} {student.lastName}
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {student.studentId}
                {application?.country ? ` · ${application.country}` : ""}
              </p>
            </div>

            {/* Notifications bell — premium pill style */}
            <Link
              href="/student/notifications"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:text-foreground active:scale-95"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            >
              <Bell className="h-5 w-5" aria-hidden />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* ── Quick stats row — 3 tappable stats ── */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {/* Application progress */}
            <Link
              href="/student/applications"
              className="group flex flex-col items-center rounded-xl border border-border/60 bg-card/60 p-2.5 text-center backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-primary/5 active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none tabular-nums">
                {progress}%
              </span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">Progress</span>
            </Link>

            {/* Documents approved */}
            <Link
              href="/student/documents"
              className="group flex flex-col items-center rounded-xl border border-border/60 bg-card/60 p-2.5 text-center backdrop-blur-sm transition-all hover:border-success/30 hover:bg-success/5 active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success transition-transform group-hover:scale-110">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none tabular-nums">
                {docSummary.approved}
                <span className="text-xs text-muted-foreground">/{docSummary.required}</span>
              </span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">Docs</span>
            </Link>

            {/* Unread notifications */}
            <Link
              href="/student/notifications"
              className="group flex flex-col items-center rounded-xl border border-border/60 bg-card/60 p-2.5 text-center backdrop-blur-sm transition-all hover:border-info/30 hover:bg-info/5 active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-info/10 text-info transition-transform group-hover:scale-110">
                <FileText className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none tabular-nums">
                {notifications.length}
              </span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">Updates</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
