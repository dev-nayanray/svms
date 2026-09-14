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
 * dashboard. A warm, premium design with:
 *
 *  - Cream/ivory gradient background (matches the Euroscope gold brand)
 *  - Gold gradient accent orbs for depth
 *  - Subtle dotted pattern overlay for texture
 *  - Larger avatar with gold gradient ring + online status dot
 *  - Greeting + name + student ID + destination country badge
 *  - Application stage pill (when an application exists)
 *  - Quick-stats row: 3 tappable stat cards
 *
 * The palette is intentionally warm (cream + gold + amber) rather
 * than the typical SaaS blue or dark mode — it feels premium and
 * European, matching the Euroscope laurel-wreath brand identity.
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
      {/* ── Premium white hero card ──
          Pure white background with subtle gold accents — clean,
          modern, and matches the Euroscope gold brand identity. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-amber-200/50",
          "bg-white dark:bg-card",
        )}
      >
        {/* ── Decorative gold gradient orbs (subtle, no shadow) ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-amber-200/30 to-yellow-100/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-yellow-100/20 to-amber-100/15 blur-3xl"
        />

        {/* ── Subtle dotted pattern overlay ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* ── Content ── */}
        <div className="relative p-5">
          {/* Top row: avatar + greeting + bell */}
          <div className="flex items-center gap-4">
            {/* Profile image / initials — larger with gold gradient ring + status dot */}
            <Link href="/student/profile" aria-label="View profile" className="group relative shrink-0">
              <span className="absolute inset-0 -m-1 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 opacity-50 blur-sm transition-opacity group-hover:opacity-80" />
              <span className="relative block">
                {student.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={student.profilePhotoUrl}
                    alt={student.firstName}
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-amber-300/50"
                  />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100 text-xl font-bold text-amber-700 ring-2 ring-amber-300/50">
                    {initials || "S"}
                  </span>
                )}
                {/* Online status dot */}
                <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 ring-2 ring-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />
                </span>
              </span>
            </Link>

            {/* Greeting text */}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm text-amber-700/80">
                <Sparkles className="h-3 w-3 text-amber-500" aria-hidden />
                {greeting},
              </p>
              <h2 id="greeting" className="text-xl font-bold tracking-tight text-slate-900 dark:text-foreground">
                {firstName} {student.lastName}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-amber-100/80 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                  {student.studentId}
                </span>
                {application?.country && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {application.country}
                  </span>
                )}
              </div>
            </div>

            {/* Notifications bell */}
            <Link
              href="/student/notifications"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 text-amber-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-amber-800 active:scale-95"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            >
              <Bell className="h-5 w-5" aria-hidden />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* ── Application stage banner (when an application exists) ── */}
          {application && (
            <Link
              href="/student/applications"
              className="group mt-4 flex items-center gap-3 rounded-xl border border-amber-200/60 bg-white/60 p-2.5 backdrop-blur-sm transition-all hover:border-amber-300 hover:bg-white/80 active:scale-[0.98]"
            >
              {/* Progress ring */}
              <div className="relative grid h-10 w-10 shrink-0 place-items-center">
                <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-amber-100" />
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
                      <stop offset="100%" stopColor="#AA7C11" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute text-[10px] font-bold text-amber-800 tabular-nums">{progress}%</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600/70">
                  Application Progress
                </p>
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-foreground">
                  {application.course ?? "Application in progress"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-amber-400 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" aria-hidden />
            </Link>
          )}

          {/* ── Quick stats row — 3 tappable stat cards ── */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {/* Application progress */}
            <Link
              href="/student/applications"
              className="group flex flex-col items-center rounded-xl border border-amber-200/60 bg-white/60 p-2.5 text-center backdrop-blur-sm transition-all hover:border-amber-400 hover:bg-white active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/15 text-amber-600 transition-transform group-hover:scale-110">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none text-slate-900 tabular-nums dark:text-foreground">
                {progress}%
              </span>
              <span className="mt-0.5 text-[10px] text-amber-700/60">Progress</span>
            </Link>

            {/* Documents approved */}
            <Link
              href="/student/documents"
              className="group flex flex-col items-center rounded-xl border border-amber-200/60 bg-white/60 p-2.5 text-center backdrop-blur-sm transition-all hover:border-emerald-400 hover:bg-white active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 transition-transform group-hover:scale-110">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none text-slate-900 tabular-nums dark:text-foreground">
                {docSummary.approved}
                <span className="text-xs text-amber-700/40">/{docSummary.required}</span>
              </span>
              <span className="mt-0.5 text-[10px] text-amber-700/60">Docs</span>
            </Link>

            {/* Updates */}
            <Link
              href="/student/notifications"
              className="group flex flex-col items-center rounded-xl border border-amber-200/60 bg-white/60 p-2.5 text-center backdrop-blur-sm transition-all hover:border-blue-400 hover:bg-white active:scale-95"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/15 text-blue-600 transition-transform group-hover:scale-110">
                <FileText className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-lg font-bold leading-none text-slate-900 tabular-nums dark:text-foreground">
                {notifications.length}
              </span>
              <span className="mt-0.5 text-[10px] text-amber-700/60">Updates</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
