import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PremiumGreetingCard — the hero card at the top of the student
 * dashboard. A modern, eye-catching design with:
 *
 *  - Dark premium gradient background (not the light wash from before)
 *  - Decorative blurred gradient orbs for depth
 *  - Subtle dotted pattern overlay for texture
 *  - Larger avatar with gradient ring + online status dot
 *  - Greeting + name + student ID + destination country badge
 *  - Application stage pill (when an application exists)
 *  - Quick-stats row: 3 tappable stat cards
 *  - "View profile" subtle link
 *
 * Stats row shows:
 *  - Application progress % (with GraduationCap icon)
 *  - Approved documents count (with CheckCircle2 icon)
 *  - Total updates count (with FileText icon)
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
  const firstName = student.firstName;

  return (
    <section aria-labelledby="greeting" className="relative">
      {/* ── Premium dark gradient hero card ── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-border shadow-lg",
          // Rich dark gradient — primary-leaning for brand cohesion
          "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
          "dark:from-slate-900 dark:via-slate-950 dark:to-slate-900",
        )}
      >
        {/* ── Decorative gradient orbs ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-primary/30 to-info/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-info/20 to-primary/10 blur-3xl"
        />

        {/* ── Subtle dotted pattern overlay ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* ── Content ── */}
        <div className="relative p-5 text-white">
          {/* Top row: avatar + greeting + bell */}
          <div className="flex items-center gap-4">
            {/* Profile image / initials — larger with gradient ring + status dot */}
            <Link href="/student/profile" aria-label="View profile" className="group relative shrink-0">
              <span className="absolute inset-0 -m-1 rounded-2xl bg-gradient-to-br from-primary to-info opacity-60 blur-sm transition-opacity group-hover:opacity-100" />
              <span className="relative block">
                {student.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={student.profilePhotoUrl}
                    alt={student.firstName}
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20"
                  />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/40 to-info/30 text-xl font-bold text-white ring-2 ring-white/20">
                    {initials || "S"}
                  </span>
                )}
                {/* Online status dot */}
                <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 ring-2 ring-slate-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                </span>
              </span>
            </Link>

            {/* Greeting text */}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm text-white/60">
                <Sparkles className="h-3 w-3 text-primary" aria-hidden />
                {greeting},
              </p>
              <h2 id="greeting" className="text-xl font-bold tracking-tight text-white">
                {firstName} {student.lastName}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white/70">
                  {student.studentId}
                </span>
                {application?.country && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/20 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {application.country}
                  </span>
                )}
              </div>
            </div>

            {/* Notifications bell */}
            <Link
              href="/student/notifications"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white active:scale-95"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            >
              <Bell className="h-5 w-5" aria-hidden />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-slate-900">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* ── Application stage banner (when an application exists) ── */}
          {application && (
            <Link
              href="/student/applications"
              className="group mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 active:scale-[0.98]"
            >
              {/* Progress ring */}
              <div className="relative grid h-10 w-10 shrink-0 place-items-center">
                <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(progress / 100) * 94.2} 94.2`}
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#D4AF37" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute text-[10px] font-bold text-white tabular-nums">{progress}%</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                  Application Progress
                </p>
                <p className="truncate text-sm font-semibold text-white">
                  {application.course ?? "Application in progress"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" aria-hidden />
            </Link>
          )}

          {/* ── Quick stats row — 3 tappable stat cards ── */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {/* Application progress */}
            <Link
              href="/student/applications"
              className="group flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-center backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-white/10 active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary transition-transform group-hover:scale-110">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none text-white tabular-nums">
                {progress}%
              </span>
              <span className="mt-0.5 text-[10px] text-white/50">Progress</span>
            </Link>

            {/* Documents approved */}
            <Link
              href="/student/documents"
              className="group flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-center backdrop-blur-sm transition-all hover:border-emerald-400/40 hover:bg-white/10 active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400 transition-transform group-hover:scale-110">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none text-white tabular-nums">
                {docSummary.approved}
                <span className="text-xs text-white/40">/{docSummary.required}</span>
              </span>
              <span className="mt-0.5 text-[10px] text-white/50">Docs</span>
            </Link>

            {/* Updates */}
            <Link
              href="/student/notifications"
              className="group flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-center backdrop-blur-sm transition-all hover:border-blue-400/40 hover:bg-white/10 active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/20 text-blue-400 transition-transform group-hover:scale-110">
                <FileText className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none text-white tabular-nums">
                {notifications.length}
              </span>
              <span className="mt-0.5 text-[10px] text-white/50">Updates</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
