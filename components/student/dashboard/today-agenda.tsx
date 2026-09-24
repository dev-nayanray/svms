import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Coffee,
  MapPin,
  Phone,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileCard } from "@/components/student/ui";
import type { TodayAgenda as TodayAgendaData } from "@/lib/services/student-dashboard";

/**
 * Today's Agenda — premium "what's happening today" widget for the
 * student dashboard. Surfaces today's appointments + tasks due today +
 * overdue tasks in a single time-sorted list, so students don't have
 * to piece it together from the "Next action" + "Upcoming deadlines"
 * + "Recent activity" sections.
 *
 * Server component — pure presentation driven by
 * `getStudentDashboard()`'s `todayAgenda` field.
 *
 * Layout (mobile-first):
 *  ┌───────────────────────────────────────────────────┐
 *  │ Today · Mon 14 Sep                  3 items        │   ← header
 *  ├───────────────────────────────────────────────────┤
 *  │ ┃ 09:30  📞  Phone call with counselor             │   ← row
 *  │ ┃           SCHEDULED                             │
 *  │ ┃ 14:00  ✓  Upload IELTS certificate               │   ← row
 *  │ ┃           Overdue                                │
 *  └───────────────────────────────────────────────────┘
 *
 * Empty state shows a positive "all clear" card with a coffee icon
 * + a gentle nudge toward exploring universities.
 */
type Tone = TodayAgendaData["items"][number]["tone"];

const TONE_ICON_BG: Record<Tone, string> = {
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  default: "bg-muted text-muted-foreground",
};

const TONE_TIME_PILL: Record<Tone, string> = {
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  default: "bg-muted text-muted-foreground",
};

function formatTodayHeader(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function MeetingMethodIcon({ method }: { method: string | null }) {
  if (method === "VIDEO_CALL") return <Video className="h-3.5 w-3.5" aria-hidden />;
  if (method === "PHONE_CALL") return <Phone className="h-3.5 w-3.5" aria-hidden />;
  if (method === "IN_PERSON") return <MapPin className="h-3.5 w-3.5" aria-hidden />;
  return <CalendarClock className="h-3.5 w-3.5" aria-hidden />;
}

export function TodayAgenda({ data }: { data: TodayAgendaData }) {
  const today = new Date();
  const itemCount = data.total;

  // ─── Empty state — premium "all clear" card ───
  if (itemCount === 0) {
    return (
      <section aria-labelledby="today-heading">
        <div className="mb-2 flex items-center justify-between">
          <h2
            id="today-heading"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Today · {formatTodayHeader(today)}
          </h2>
        </div>
        <MobileCard className="flex items-center gap-3 border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/10">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <Coffee className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">You&rsquo;re all caught up</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.emptyMessage ?? "Nothing scheduled today."}
            </p>
          </div>
          <Link
            href="/student/universities"
            className="inline-flex min-h-[36px] shrink-0 items-center rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/25"
          >
            Explore →
          </Link>
        </MobileCard>
      </section>
    );
  }

  // ─── Populated state — time-grouped list ───
  return (
    <section aria-labelledby="today-heading">
      <div className="mb-2 flex items-center justify-between">
        <h2
          id="today-heading"
          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Today · {formatTodayHeader(today)}
        </h2>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <MobileCard className="divide-y divide-border p-0">
        <ol className="list-none">
          {data.items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                href={item.href}
                className="flex items-start gap-3 p-3 transition-colors hover:bg-amber-50/30 focus-visible:outline-2 focus-visible:outline-amber-500 dark:hover:bg-amber-950/10"
              >
                {/* ── Left rail: time pill + tone stripe ── */}
                <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 pt-0.5">
                  <span
                    className={cn(
                      "grid min-w-[3rem] place-items-center rounded-md px-1.5 py-1 text-[11px] font-bold tabular-nums",
                      TONE_TIME_PILL[item.tone],
                    )}
                  >
                    {item.timeLabel}
                  </span>
                </div>

                {/* ── Middle: icon + title + subtitle ── */}
                <span
                  className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    TONE_ICON_BG[item.tone],
                  )}
                  aria-hidden
                >
                  {item.kind === "APPOINTMENT" ? (
                    <MeetingMethodIcon method={item.subtitle === "Video call" ? "VIDEO_CALL" : item.subtitle === "Phone call" ? "PHONE_CALL" : item.subtitle === "In-person meeting" ? "IN_PERSON" : null} />
                  ) : (
                    <CheckSquare className="h-4 w-4" aria-hidden />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-snug">
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </p>
                  )}
                </div>

                {/* ── Right: status badge / kind tag ── */}
                {item.tone === "destructive" ? (
                  <span className="mt-0.5 shrink-0 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                    {item.timeLabel === "Overdue" ? "Overdue" : "Urgent"}
                  </span>
                ) : item.kind === "APPOINTMENT" && item.status === "CONFIRMED" ? (
                  <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Confirmed
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>
      </MobileCard>
    </section>
  );
}
