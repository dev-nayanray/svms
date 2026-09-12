import { cn } from "@/lib/utils";
import {
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Bell,
  Plane,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Container — max-width + responsive horizontal padding. */
export function Container({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("euroscope-container", className)} {...props} />;
}

/** Section — vertical padding + optional dark/bordered variants. */
export function Section({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone?: "default" | "muted" | "dark" }) {
  const tones = {
    default: "bg-background text-foreground",
    muted: "bg-muted/50 text-foreground",
    dark: "bg-ink text-white",
  };
  return (
    <section className={cn("py-16 md:py-24", tones[tone], className)} {...props} />
  );
}

/** Eyebrow — small label above headings. */
export function Eyebrow({
  children,
  className,
  tone = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "primary" | "accent" | "light";
}) {
  const tones = {
    primary: "text-primary",
    accent: "text-accent",
    light: "text-white/70",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** MarketingButton — extends the shared Button with marketing variants. */
export function MarketingButton({
  href,
  children,
  variant = "primary",
  size = "default",
  className,
  ...props
}: {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "outline" | "accent";
  size?: "default" | "sm" | "lg";
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement> &
  React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50";
  const sizes = {
    default: "h-11 px-5 text-sm",
    sm: "h-9 px-3.5 text-sm",
    lg: "h-12 px-7 text-base",
  };
  const variants = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-md",
    secondary:
      "bg-white text-ink hover:bg-muted border border-border shadow-sm",
    ghost: "text-foreground hover:bg-muted",
    outline:
      "border border-border bg-transparent text-foreground hover:bg-muted",
    accent:
      "bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm hover:shadow-md",
  };
  const classes = cn(base, sizes[size], variants[variant], className);
  if (href) {
    return (
      <a href={href} className={classes} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

/** FeatureCard — consistent card for feature grids. */
export function FeatureCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/** Reusable icon registry — single source for marketing icon names. */
export const MARKETING_ICONS: Record<string, LucideIcon> = {
  bookOpen: BookOpen,
  building: Building2,
  calendar: Calendar,
  clipboard: ClipboardCheck,
  creditCard: CreditCard,
  fileText: FileText,
  graduation: GraduationCap,
  dashboard: LayoutDashboard,
  mapPin: MapPin,
  message: MessageSquare,
  bell: Bell,
  plane: Plane,
  shield: Shield,
  shieldCheck: ShieldCheck,
  sparkles: Sparkles,
  users: Users,
};
