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

export function NotificationBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} unread notifications`}
      className={cn(
        "absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Mobile page container — generous spacing above bottom nav. */
export function MobilePage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-5 pb-28 md:pb-6", className)}>{children}</div>;
}

/** Premium card with hover lift + shadow. */
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
    "rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200",
    href && "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
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
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold tracking-tight">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            {pct}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover transition-[width] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        {footer && <div className="mt-3 text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

/** Premium quick action tile with icon badge + hover. */
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
      className="group flex min-h-[80px] flex-col items-start gap-2.5 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition-all duration-200 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </span>
      <span className="text-sm font-semibold leading-tight">{label}</span>
      {description && <span className="text-xs leading-tight text-muted-foreground">{description}</span>}
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
                step.state === "done" ? "bg-primary" : "bg-border"
              )}
            />
          )}
          <span
            aria-hidden
            className={cn(
              "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold transition-colors",
              step.state === "done" && "border-primary bg-primary text-primary-foreground",
              step.state === "current" && "border-primary bg-primary/15 text-primary ring-4 ring-primary/10",
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
        <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
