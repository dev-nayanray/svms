"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/overlays";
import { House, FolderKanban, FileText, MessageSquare, UserRound, Building2, BookOpen, Stamp, CheckSquare, CreditCard, Receipt, CalendarClock, Bell, LifeBuoy, Settings } from "lucide-react";

export const STUDENT_NAV_ICONS = {
  House, FolderKanban, FileText, MessageSquare, UserRound, Building2, BookOpen,
  Stamp, CheckSquare, CreditCard, Receipt, CalendarClock, Bell, LifeBuoy, Settings,
} as const;

export type StudentNavIconName = keyof typeof STUDENT_NAV_ICONS;

export function StudentNavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = STUDENT_NAV_ICONS[name as StudentNavIconName] ?? House;
  return <Icon className={className} aria-hidden />;
}

/**
 * ── Design tokens ─────────────────────────────────────────
 * Single source of truth for the student panel's visual language.
 * Always import these instead of hardcoding Tailwind strings —
 * if a token needs to change, change it here and every consumer
 * updates automatically.
 *
 * Brand accent: amber/gold (Euroscope laurel-wreath identity).
 * Surfaces: white / card with subtle border.
 * Radius: 2xl for cards, xl for inputs/buttons.
 * Spacing: page space-y-4, card p-4, intra-section gap-3.
 * Shadow: only on hover (shadow-md).
 */
export const STUDENT_TOKENS = {
  /** Card surface — unified radius, border, padding. */
  card: "rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200",
  /** Card with hover lift — used on tappable cards. */
  cardHover: "hover:border-amber-300/60 hover:shadow-md active:scale-[0.98]",
  /** Primary CTA button — amber gradient. */
  ctaPrimary:
    "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-amber-700 hover:shadow-md active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
  /** Secondary button — ghost style. */
  ctaGhost:
    "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
  /** Section label — small, uppercase, muted. */
  sectionLabel:
    "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
  /** "View all" link — amber accent. */
  viewAllLink:
    "text-xs font-semibold text-amber-600 transition-colors hover:text-amber-700",
  /** Status dot base. */
  statusDot: "h-1.5 w-1.5 rounded-full",
} as const;

export function NotificationBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} unread notifications`}
      className={cn(
        "absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card shadow-sm",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:hidden"
      />
      <span className="relative">{count > 9 ? "9+" : count}</span>
    </span>
  );
}

/** Mobile page container — generous spacing above bottom nav.
 *  Uses max-w-lg for better large-screen utilization. */
export function MobilePage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-lg space-y-5 pb-24 md:pb-6", className)}>
      {children}
    </div>
  );
}

/** Premium card — clean, subtle border, refined hover.
 *  Uses unified design tokens for radius/border/padding. */
export function MobileCard({
  as = "div",
  href,
  className,
  children,
  ...props
}: {
  as?: "div" | "link";
  href?: string;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const classes = cn(
    STUDENT_TOKENS.card,
    href && STUDENT_TOKENS.cardHover,
    className,
  );
  if (as === "link" && href) {
    return (
      <Link href={href} className={classes} {...(props as object)}>
        {children}
      </Link>
    );
  }
  return <div className={classes} {...props}>{children}</div>;
}

/**
 * StudentSection — unified section wrapper with header row.
 * Replaces ad-hoc <section><h3>...</section> blocks across pages.
 *
 * Header row shows:
 *  - The section label (uppercase, muted)
 *  - An optional "View all →" link on the right
 *
 * Body is rendered as children with `space-y-2` by default; pass
 * `bodyClassName="grid grid-cols-2 gap-3"` etc. for custom layouts.
 */
export function StudentSection({
  id,
  label,
  viewAllHref,
  viewAllLabel = "View all",
  children,
  className,
  bodyClassName = "space-y-2",
  stagger = false,
}: {
  id?: string;
  label: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** If true, applies staggered fade-up animation to children. */
  stagger?: boolean;
}) {
  const headingId = id ?? `${label.replace(/\s+/g, "-").toLowerCase()}-heading`;
  return (
    <section aria-labelledby={headingId} className={cn("stagger-group", className)}>
      <div className="mb-2 flex items-center justify-between">
        <h3 id={headingId} className={STUDENT_TOKENS.sectionLabel}>
          {label}
        </h3>
        {viewAllHref && (
          <Link href={viewAllHref} className={STUDENT_TOKENS.viewAllLink}>
            {viewAllLabel} →
          </Link>
        )}
      </div>
      <div className={cn(stagger && "stagger-children", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * StudentStatCard — unified stat tile for KPI rows.
 * Variant `compact` is used inside grids of 3-4; `default` for standalone.
 */
export function StudentStatCard({
  icon,
  value,
  label,
  sublabel,
  tone = "default",
  href,
  className,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  sublabel?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  href?: string;
  className?: string;
}) {
  const TONES: Record<string, string> = {
    default: "bg-amber-500/10 text-amber-600",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    destructive: "bg-red-500/10 text-red-600",
    info: "bg-blue-500/10 text-blue-600",
  };
  const VALUE_TONES: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    destructive: "text-red-600",
    info: "text-blue-600",
  };

  const inner = (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-border/60 bg-card p-3 text-center transition-all",
        href && "hover:border-amber-300/60 hover:shadow-md active:scale-[0.98]",
        className,
      )}
    >
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg", TONES[tone])}>
        {icon}
      </span>
      <span className={cn("mt-1.5 text-lg font-bold leading-none tabular-nums", VALUE_TONES[tone])}>
        {value}
      </span>
      {sublabel && (
        <span className="text-[10px] text-muted-foreground">{sublabel}</span>
      )}
      <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

/**
 * StudentEmptyState — unified empty state for sections.
 * Replaces ad-hoc "no data" cards with a consistent look.
 */
export function StudentEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 p-6 text-center",
        className,
      )}
    >
      {icon && (
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
          {icon}
        </span>
      )}
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * StatusBadge — unified status pill.
 * Use for "Approved", "Pending", "Overdue", etc.
 */
export function StatusBadge({
  tone = "default",
  children,
  className,
}: {
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const TONES: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    destructive: "bg-red-500/10 text-red-600",
    info: "bg-blue-500/10 text-blue-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Progress card with gradient bar + percentage badge. */
export function ProgressCard({
  title,
  subtitle,
  percent,
  footer,
}: {
  title: string;
  subtitle?: string;
  percent: number;
  footer?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={cn(STUDENT_TOKENS.card, "p-0")}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold tracking-tight">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600">
            {pct}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-[width] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        {footer && <div className="mt-3 text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

/** Premium quick action tile — gold accent, refined hover. */
export function QuickAction({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[80px] flex-col items-start gap-2 rounded-2xl border border-border/60 bg-card p-3 transition-all duration-200 hover:border-amber-300/60 hover:bg-amber-50/30 hover:shadow-md active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:hover:bg-amber-950/10"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600 transition-all duration-200 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white">
        {icon}
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      {description && <span className="text-[11px] leading-tight text-muted-foreground">{description}</span>}
    </Link>
  );
}

/** Visual timeline with connecting lines + state dots. */
export function Timeline({
  steps,
}: {
  steps: { label: string; caption?: string; state: "done" | "current" | "pending" }[];
}) {
  return (
    <ol className="space-y-0" aria-label="Application timeline">
      {steps.map((step, i) => (
        <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute left-[10px] top-6 h-[calc(100%-20px)] w-0.5 rounded-full",
                step.state === "done" ? "bg-amber-500" : "bg-border"
              )}
            />
          )}
          <span
            aria-hidden
            className={cn(
              "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold transition-colors",
              step.state === "done" && "border-amber-500 bg-amber-500 text-white",
              step.state === "current" && "border-amber-500 bg-amber-500/15 text-amber-600 ring-4 ring-amber-500/10",
              step.state === "pending" && "border-border bg-card text-muted-foreground"
            )}
          >
            {step.state === "done" ? "✓" : i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p
              className={cn(
                "text-sm leading-5",
                step.state === "pending" ? "text-muted-foreground" : "font-semibold"
              )}
            >
              {step.label}
              {step.state === "current" && <span className="sr-only"> (current stage)</span>}
            </p>
            {step.caption && <p className="mt-0.5 text-xs text-muted-foreground">{step.caption}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Skeleton grid with premium shimmer. */
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(STUDENT_TOKENS.card)}>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
