import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileCard } from "@/components/student/ui";
import type { ProfileCompletionResult } from "@/lib/utils/profile-completion";

/**
 * Profile Completion banner — shown on the student dashboard between
 * Today's Agenda and the Application Progress card.
 *
 * The goal is a soft nudge, not a wall of fields. Surfaces:
 *  - The completion percentage with a progress bar
 *  - The single most impactful next-missing-field, with a clear CTA
 *  - Tonal escalation: red under 50%, amber 50-79%, blue 80-99%
 *
 * Hidden when percent === 100 — students with a complete profile
 * don't need a nudge, the dashboard's "next action" card is enough.
 *
 * Server component — pure presentation driven by the
 * `profileCompletion` field from getStudentDashboard().
 */

type Tone = "destructive" | "warning" | "info" | "success";

function toneFor(percent: number): Tone {
  if (percent >= 100) return "success";
  if (percent >= 80) return "info";
  if (percent >= 50) return "warning";
  return "destructive";
}

const TONE_CLASSES: Record<Tone, {
  card: string;
  bar: string;
  icon: string;
  badge: string;
  cta: string;
}> = {
  destructive: {
    card: "border-destructive/30 bg-destructive/5",
    bar: "bg-destructive",
    icon: "bg-destructive/15 text-destructive",
    badge: "bg-destructive/10 text-destructive",
    cta: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  warning: {
    card: "border-warning/30 bg-warning/5",
    bar: "bg-warning",
    icon: "bg-warning/15 text-warning",
    badge: "bg-warning/10 text-warning",
    cta: "bg-warning text-warning-foreground hover:bg-warning/90",
  },
  info: {
    card: "border-info/30 bg-info/5",
    bar: "bg-info",
    icon: "bg-info/15 text-info",
    badge: "bg-info/10 text-info",
    cta: "bg-info text-info-foreground hover:bg-info/90",
  },
  success: {
    card: "border-success/30 bg-success/5",
    bar: "bg-success",
    icon: "bg-success/15 text-success",
    badge: "bg-success/10 text-success",
    cta: "bg-success text-success-foreground hover:bg-success/90",
  },
};

const ENCOURAGEMENT: { threshold: number; message: string }[] = [
  { threshold: 0,   message: "Let's get your profile set up — this unlocks your counselor's full support." },
  { threshold: 25,  message: "Great start — a few more details will speed up your application." },
  { threshold: 50,  message: "Halfway there — your counselor is already working with what you've shared." },
  { threshold: 75,  message: "Almost done — finishing these last fields will boost your application." },
  { threshold: 90,  message: "Final stretch — these last few fields make your profile complete." },
];

function encouragementFor(percent: number): string {
  // Pick the highest threshold whose value <= percent
  let msg = ENCOURAGEMENT[0].message;
  for (const tier of ENCOURAGEMENT) {
    if (percent >= tier.threshold) msg = tier.message;
  }
  return msg;
}

export function ProfileCompletionCard({
  completion,
}: {
  completion: ProfileCompletionResult;
}) {
  const percent = completion.percent;
  // Hide entirely when complete — no need to nudge students who are done.
  if (percent >= 100) return null;

  const tone = toneFor(percent);
  const cls = TONE_CLASSES[tone];

  // Pick the next most impactful missing field. The completion helper
  // returns fields in PROFILE_SECTIONS order (personal → contact →
  // address → passport → academic → english → emergency). That order
  // already reflects "what blocks the application most" — passport is
  // required for visa, address is required for courier, etc. So the
  // first missing entry is by definition the highest-priority nudge.
  const nextMissing = completion.missing[0] ?? null;
  const encouragement = encouragementFor(percent);
  const missingCount = completion.missing.length;

  return (
    <section aria-labelledby="profile-completion-heading">
      <MobileCard className={cn("p-4", cls.card)}>
        {/* ── Header row: icon + title + percent badge ── */}
        <div className="flex items-start gap-3">
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", cls.icon)} aria-hidden>
            {tone === "destructive" || tone === "warning" ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="profile-completion-heading"
                className="text-sm font-semibold tracking-tight"
              >
                Profile completion
              </h2>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", cls.badge)}>
                {percent}%
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              {encouragement}
            </p>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completion"
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-[width] motion-reduce:transition-none", cls.bar)}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* ── Next missing field + CTA ── */}
        {nextMissing ? (
          <div className="mt-3 rounded-lg border border-border bg-card/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {missingCount === 1 ? "1 field left" : `${missingCount} fields left`} · Next up
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {nextMissing.label}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  in {nextMissing.section}
                </p>
              </div>
              <Link
                href="/student/profile"
                className={cn(
                  "inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  cls.cta,
                )}
              >
                Complete
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        ) : (
          // Should be unreachable — percent < 100 implies missing.length > 0 —
          // but defensively render a simple CTA if the helper ever changes shape.
          <Link
            href="/student/profile"
            className={cn(
              "mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              cls.cta,
            )}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Review profile
          </Link>
        )}
      </MobileCard>
    </section>
  );
}
