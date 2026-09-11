"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, Badge } from "@/components/ui";
import { Skeleton } from "@/components/ui/overlays";
import { House, FolderKanban, FileText, MessageSquare, UserRound, Building2, BookOpen, Stamp, CheckSquare, CreditCard, Receipt, CalendarClock, Bell, LifeBuoy, Settings } from "lucide-react";

/** Re-exported registry so serialized nav configs can resolve icons client-side. */
export const STUDENT_NAV_ICONS = {
  House, FolderKanban, FileText, MessageSquare, UserRound, Building2, BookOpen,
  Stamp, CheckSquare, CreditCard, Receipt, CalendarClock, Bell, LifeBuoy, Settings,
} as const;

export type StudentNavIconName = keyof typeof STUDENT_NAV_ICONS;

export function StudentNavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = STUDENT_NAV_ICONS[name as StudentNavIconName] ?? House;
  return <Icon className={className} aria-hidden />;
}

/** Small numeric badge for notification counts; hidden when zero. */
export function NotificationBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} unread notifications`}
      className={cn(
        "absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Mobile page container: consistent padding + safe spacing above bottom nav. */
export function MobilePage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-4 pb-28 md:pb-6", className)}>{children}</div>;
}

/** Compact touch-friendly card used across the student panel. */
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
  const classes = cn("rounded-xl border border-border bg-card p-4 shadow-sm", className);
  if (as === "link" && href) {
    return (
      <Link href={href} className={cn(classes, "active:scale-[0.99] transition-transform")} {...(props as object)}>
        {children}
      </Link>
    );
  }
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

/** Horizontal progress indicator with accessible semantics. */
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <Badge tone="info">{pct}%</Badge>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
        {footer && <div className="mt-3 text-xs text-muted-foreground">{footer}</div>}
      </CardContent>
    </Card>
  );
}

/** Touch-friendly quick action tile (min 44px target). */
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
      className="flex min-h-[76px] flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <span className="text-sm font-medium leading-tight">{label}</span>
      {description && <span className="text-xs leading-tight text-muted-foreground">{description}</span>}
    </Link>
  );
}

/** Vertical stage timeline with completed/current/pending states. */
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
                "absolute left-[9px] top-5 h-[calc(100%-16px)] w-0.5",
                step.state === "done" ? "bg-primary" : "bg-border"
              )}
            />
          )}
          <span
            aria-hidden
            className={cn(
              "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[10px]",
              step.state === "done" && "border-primary bg-primary text-primary-foreground",
              step.state === "current" && "border-primary bg-primary/15 text-primary",
              step.state === "pending" && "border-border bg-card text-muted-foreground"
            )}
          >
            {step.state === "done" ? "✓" : i + 1}
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm leading-5",
                step.state === "pending" ? "text-muted-foreground" : "font-medium"
              )}
            >
              {step.label}
              {step.state === "current" && <span className="sr-only"> (current stage)</span>}
            </p>
            {step.caption && <p className="text-xs text-muted-foreground">{step.caption}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Skeleton grid for mobile card lists. */
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
