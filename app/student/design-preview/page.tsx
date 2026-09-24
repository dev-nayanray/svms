import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  FileUp,
  FolderKanban,
  FolderOpen,
  Mail,
  MessageSquare,
  Plus,
  Upload,
  X,
} from "lucide-react";
import {
  MobilePage,
  MobileCard,
  StudentStatCard,
  StudentEmptyState,
  StudentErrorState,
  StatusBadge,
  FilterChip,
  PageHeader,
  ProgressCard,
  QuickAction,
  Timeline,
  NotificationBadge,
  LoadingCards,
  STUDENT_TOKENS,
} from "@/components/student/ui";
import { Button } from "@/components/ui";
import { requireStudentProfile } from "@/lib/student/guard";

export const dynamic = "force-dynamic";

/**
 * /student/design-preview — Design system preview page.
 *
 * Renders every shared component from components/student/ui.tsx in
 * every meaningful state, so designers and contributors can see the
 * full visual language at a glance without hunting through real
 * pages.
 *
 * Sections:
 *  1. Page header
 *  2. Color palette — all 5 tones
 *  3. Status badges — all 5 tones
 *  4. Filter chips — inactive, active, active+count
 *  5. Stat cards — all 5 tones
 *  6. Cards — basic, hover, link
 *  7. Empty state
 *  8. Error state (server) + offline state
 *  9. Progress card
 * 10. Quick actions
 * 11. Timeline — done/current/pending
 * 12. Notification badge — 0, 1, 9, 99+
 * 13. Loading skeleton
 * 14. Buttons — primary CTA, ghost, destructive
 * 15. Section group header pattern
 */
export default async function DesignPreviewPage() {
  // Reuse the same auth guard as the rest of /student/* — this page
  // is only visible to logged-in students, not the public.
  await requireStudentProfile();

  return (
    <MobilePage>
      {/* ── 1. PAGE HEADER ─────────────────────────────────────── */}
      <PageHeader
        title="Design System Preview"
        subtitle="Every shared component, every state. Use this as the visual source of truth."
        icon={<FileText className="h-5 w-5" aria-hidden />}
        badge={<StatusBadge tone="info">v1</StatusBadge>}
        action={
          <Link
            href="/student"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Exit
          </Link>
        }
      />

      {/* ── 2. COLOR PALETTE ───────────────────────────────────── */}
      <SectionGroup title="Color Palette" hint="Explicit Tailwind colors — no semantic CSS variables">
        <MobileCard>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <PaletteTile name="Success" classes="bg-emerald-500/10 text-emerald-600" border="border-emerald-300/60" />
            <PaletteTile name="Warning" classes="bg-amber-500/10 text-amber-600" border="border-amber-300/60" />
            <PaletteTile name="Info" classes="bg-blue-500/10 text-blue-600" border="border-blue-300/60" />
            <PaletteTile name="Destructive" classes="bg-red-500/10 text-red-600" border="border-red-300/60" />
            <PaletteTile name="Default" classes="bg-muted text-muted-foreground" border="border-border/60" />
            <PaletteTile name="Brand (Amber)" classes="bg-gradient-to-br from-amber-500 to-amber-600 text-white" border="border-amber-300/60" />
          </div>
        </MobileCard>
      </SectionGroup>

      {/* ── 3. STATUS BADGES ───────────────────────────────────── */}
      <SectionGroup title="Status Badges" hint="Replaces Badge from @/components/ui in all student code">
        <MobileCard>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge>Default</StatusBadge>
            <StatusBadge tone="success">Success</StatusBadge>
            <StatusBadge tone="warning">Warning</StatusBadge>
            <StatusBadge tone="info">Info</StatusBadge>
            <StatusBadge tone="destructive">Destructive</StatusBadge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <StatusBadge>{42}</StatusBadge>
            <StatusBadge tone="success">Paid</StatusBadge>
            <StatusBadge tone="warning">Pending</StatusBadge>
            <StatusBadge tone="info">Issued</StatusBadge>
            <StatusBadge tone="destructive">Overdue</StatusBadge>
          </div>
        </MobileCard>
      </SectionGroup>

      {/* ── 4. FILTER CHIPS ────────────────────────────────────── */}
      <SectionGroup title="Filter Chips" hint="Used for tab rows in documents, tasks, notifications, etc.">
        <MobileCard>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={false} onClick={() => {}}>Inactive</FilterChip>
            <FilterChip active={true} onClick={() => {}}>Active</FilterChip>
            <FilterChip active={true} onClick={() => {}} count={3}>Active + count</FilterChip>
            <FilterChip active={true} onClick={() => {}} count={12}>Overflow (9+)</FilterChip>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <FilterChip active={false} onClick={() => {}}>
              <Bell className="h-3 w-3" aria-hidden /> All
            </FilterChip>
            <FilterChip active={true} onClick={() => {}} count={7}>
              <Mail className="h-3 w-3" aria-hidden /> Unread
            </FilterChip>
          </div>
        </MobileCard>
      </SectionGroup>

      {/* ── 5. STAT CARDS ──────────────────────────────────────── */}
      <SectionGroup title="Stat Cards" hint="KPI tiles for dashboard grids. All 5 tones + tappable variant.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StudentStatCard
            icon={<FileText className="h-4 w-4" aria-hidden />}
            value={12}
            label="Required"
          />
          <StudentStatCard
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
            value={8}
            label="Approved"
            tone="success"
          />
          <StudentStatCard
            icon={<Clock className="h-4 w-4" aria-hidden />}
            value={2}
            label="In Review"
            tone="info"
          />
          <StudentStatCard
            icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
            value={1}
            label="Rejected"
            tone="destructive"
          />
          <StudentStatCard
            icon={<FileUp className="h-4 w-4" aria-hidden />}
            value={1}
            label="Pending"
            tone="warning"
          />
          <StudentStatCard
            icon={<FolderKanban className="h-4 w-4" aria-hidden />}
            value="68%"
            label="Progress"
            href="/student"
          />
        </div>
      </SectionGroup>

      {/* ── 6. CARDS ───────────────────────────────────────────── */}
      <SectionGroup title="Cards" hint="Basic, tappable (link), and tone-bordered variants">
        <MobileCard>
          <p className="text-sm font-bold tracking-tight">Basic card</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Uses STUDENT_TOKENS.card — rounded-2xl border-border/60 bg-card p-4
          </p>
        </MobileCard>

        <MobileCard as="link" href="/student">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold tracking-tight">Tappable card</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Hover lifts, active scales</p>
            </div>
            <ArrowRight className="h-4 w-4 text-amber-600" aria-hidden />
          </div>
        </MobileCard>

        <MobileCard className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10">
          <p className="text-sm font-bold text-amber-600">Tone-bordered card (warning)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">For attention-required content</p>
        </MobileCard>

        <MobileCard className="border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/10">
          <p className="text-sm font-bold text-emerald-600">Tone-bordered card (success)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">For completed / positive states</p>
        </MobileCard>
      </SectionGroup>

      {/* ── 7. EMPTY STATE ─────────────────────────────────────── */}
      <SectionGroup title="Empty State" hint="Dashed border, centered icon, optional action">
        <StudentEmptyState
          icon={<FolderOpen className="h-5 w-5" aria-hidden />}
          title="No applications yet"
          description="Browse universities and shortlist your favorites to start an application."
          action={
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden /> Browse Universities
            </Button>
          }
        />
      </SectionGroup>

      {/* ── 8. ERROR + OFFLINE STATES ──────────────────────────── */}
      <SectionGroup title="Error & Offline States" hint="Replaces every ad-hoc 'Couldn't load X' card">
        <StudentErrorState
          title="Couldn't load your documents"
          description="Please try again in a moment."
          onRetry={() => {}}
        />

        <StudentErrorState
          online={false}
          title="You're offline"
          description="Check your connection and try again."
          onRetry={() => {}}
        />
      </SectionGroup>

      {/* ── 9. PROGRESS CARD ───────────────────────────────────── */}
      <SectionGroup title="Progress Card" hint="Gradient bar + percentage badge">
        <ProgressCard
          title="Germany — MSc Computer Science"
          subtitle="APP-2024-0142 · Technical University of Munich"
          percent={68}
          footer={
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Document review</span>
              <Link href="/student" className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-amber-600">
                View application <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          }
        />

        <ProgressCard title="Low progress (15%)" percent={15} />
        <ProgressCard title="High progress (92%)" percent={92} />
      </SectionGroup>

      {/* ── 10. QUICK ACTIONS ──────────────────────────────────── */}
      <SectionGroup title="Quick Actions" hint="Gold icon containers with hover-to-filled effect">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction
            href="/student"
            icon={<FileUp className="h-4 w-4" aria-hidden />}
            label="Upload Document"
            description="Requested files"
          />
          <QuickAction
            href="/student"
            icon={<FolderKanban className="h-4 w-4" aria-hidden />}
            label="View Application"
            description="Status & timeline"
          />
          <QuickAction
            href="/student"
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            label="Contact Counselor"
            description="Ask a question"
          />
          <QuickAction
            href="/student"
            icon={<CreditCard className="h-4 w-4" aria-hidden />}
            label="Make Payment"
            description="Invoices & dues"
          />
        </div>
      </SectionGroup>

      {/* ── 11. TIMELINE ───────────────────────────────────────── */}
      <SectionGroup title="Timeline" hint="Done / current / pending dots with connecting lines">
        <MobileCard>
          <Timeline
            steps={[
              { label: "Profile created", caption: "Sep 1, 2024", state: "done" },
              { label: "Documents submitted", caption: "Sep 8, 2024", state: "done" },
              { label: "Application review", caption: "In progress", state: "current" },
              { label: "University decision", state: "pending" },
              { label: "Visa application", state: "pending" },
              { label: "Enrollment", state: "pending" },
            ]}
          />
        </MobileCard>
      </SectionGroup>

      {/* ── 12. NOTIFICATION BADGE ─────────────────────────────── */}
      <SectionGroup title="Notification Badge" hint="Red dot with ping animation. Hidden when count=0.">
        <MobileCard>
          <div className="flex items-center gap-6">
            <BadgeDemo count={0} label="0 (hidden)" />
            <BadgeDemo count={1} label="1" />
            <BadgeDemo count={5} label="5" />
            <BadgeDemo count={9} label="9" />
            <BadgeDemo count={15} label="15 (9+)" />
          </div>
        </MobileCard>
      </SectionGroup>

      {/* ── 13. LOADING SKELETON ───────────────────────────────── */}
      <SectionGroup title="Loading Skeleton" hint="Premium shimmer. Use while fetching.">
        <LoadingCards count={3} />
      </SectionGroup>

      {/* ── 14. BUTTONS ────────────────────────────────────────── */}
      <SectionGroup title="Buttons" hint="Primary CTA, ghost, destructive, plus unified tokens">
        <MobileCard>
          <div className="flex flex-wrap items-center gap-3">
            <button className={STUDENT_TOKENS.ctaPrimary}>
              <Plus className="h-4 w-4" aria-hidden /> Primary CTA
            </button>
            <button className={STUDENT_TOKENS.ctaGhost}>
              <Upload className="h-4 w-4" aria-hidden /> Ghost
            </button>
            <Button size="sm">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Button (sm)
            </Button>
            <Button size="sm" variant="outline">
              <Clock className="h-3.5 w-3.5" aria-hidden /> Outline
            </Button>
            <Button size="sm" variant="destructive">
              <X className="h-3.5 w-3.5" aria-hidden /> Destructive
            </Button>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Icon-only buttons (44px touch target)
            </p>
            <div className="flex items-center gap-2">
              <button
                aria-label="Refresh"
                className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-amber-500 active:scale-95"
              >
                <CalendarClock className="h-5 w-5" aria-hidden />
              </button>
              <button
                aria-label="Add"
                className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-amber-500 active:scale-95"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
              <button
                aria-label="Bell"
                className="relative grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-amber-500 active:scale-95"
              >
                <Bell className="h-5 w-5" aria-hidden />
                <NotificationBadge count={3} />
              </button>
            </div>
          </div>
        </MobileCard>
      </SectionGroup>

      {/* ── 15. SECTION GROUP HEADER ───────────────────────────── */}
      <SectionGroup title="Section Group Header" hint="Used on the dashboard to group cards into Today / Progress / Quick Access">
        <div className="flex items-center gap-2 px-1">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <h2 className="text-sm font-bold tracking-tight text-foreground">Group name</h2>
        </div>
        <MobileCard>
          <p className="text-xs text-muted-foreground">
            The gold accent bar + bold label above is the pattern for grouping dashboard sections.
            Each group is wrapped in <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">stagger-children</code> so
            cards fade in with a 50ms incremental delay.
          </p>
        </MobileCard>
      </SectionGroup>

      {/* ── 16. DESIGN TOKENS REFERENCE ────────────────────────── */}
      <SectionGroup title="Design Tokens" hint="STUDENT_TOKENS constant — single source of truth">
        <MobileCard>
          <dl className="space-y-2 text-xs">
            <TokenRow name="STUDENT_TOKENS.card" value="rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200" />
            <TokenRow name="STUDENT_TOKENS.cardHover" value="hover:border-amber-300/60 hover:shadow-md active:scale-[0.98]" />
            <TokenRow name="STUDENT_TOKENS.ctaPrimary" value="bg-gradient-to-br from-amber-500 to-amber-600 text-white" />
            <TokenRow name="STUDENT_TOKENS.ctaGhost" value="border border-border bg-card text-foreground" />
            <TokenRow name="STUDENT_TOKENS.sectionLabel" value="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" />
            <TokenRow name="STUDENT_TOKENS.viewAllLink" value="text-xs font-semibold text-amber-600" />
            <TokenRow name="STUDENT_TOKENS.statusDot" value="h-1.5 w-1.5 rounded-full" />
          </dl>
        </MobileCard>
      </SectionGroup>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <MobileCard className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10 text-center">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          See <code className="rounded bg-amber-500/10 px-1 py-0.5 font-mono">STUDENT_DESIGN_SYSTEM.md</code> for the full spec.
        </p>
      </MobileCard>
    </MobilePage>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function SectionGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="stagger-children space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
        <div>
          <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function PaletteTile({
  name,
  classes,
  border,
}: {
  name: string;
  classes: string;
  border: string;
}) {
  return (
    <div className={cn("rounded-xl border p-3 text-center", border)}>
      <span className={cn("grid h-10 w-10 place-items-center rounded-lg mx-auto", classes)}>
        <span className="text-xs font-bold">A</span>
      </span>
      <p className="mt-2 text-xs font-semibold">{name}</p>
    </div>
  );
}

function BadgeDemo({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Bell className="h-5 w-5" aria-hidden />
        <NotificationBadge count={count} />
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function TokenRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/40 pb-2 last:border-0 last:pb-0 sm:flex-row sm:gap-3">
      <dt className="shrink-0 font-mono text-[11px] font-semibold text-amber-600 sm:w-56">{name}</dt>
      <dd className="font-mono text-[10px] text-muted-foreground">{value}</dd>
    </div>
  );
}

// Inline cn to avoid an extra import line for the helper components
function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
