import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FolderKanban,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import {
  StatCard,
  EmptyState,
  TableShell,
  Pagination,
  StatusBadge,
} from "@/components/shared";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /admin/design-preview — Design system preview page for the admin
 * panel. Same shared components as /employee/design-preview (both
 * panels use components/shared/*), but rendered here for admin-role
 * users to view without leaving the admin layout.
 *
 * Auth: ADMIN role only.
 */
export default async function AdminDesignPreviewPage() {
  const session = await getSession();
  if (session.user.role !== "ADMIN") {
    redirect("/403");
  }

  return (
    <div className="space-y-6">
      {/* ── PAGE HEADER ────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Design System Preview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every shared component, every state. Use this as the visual source of truth for admin UI.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" aria-hidden /> Exit
        </Link>
      </div>

      {/* ── 1. STATUS COLOR PALETTE ────────────────────────────── */}
      <Section title="1. Status Color Palette" hint="Explicit Tailwind colors — shared with student + employee panels.">
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <PaletteTile name="Success" classes="bg-emerald-500/10 text-emerald-600" border="border-emerald-500/20" />
            <PaletteTile name="Warning" classes="bg-amber-500/10 text-amber-600" border="border-amber-500/20" />
            <PaletteTile name="Info" classes="bg-blue-500/10 text-blue-600" border="border-blue-500/20" />
            <PaletteTile name="Destructive" classes="bg-red-500/10 text-red-600" border="border-red-500/20" />
            <PaletteTile name="Default" classes="bg-muted text-muted-foreground" border="border-border" />
          </CardContent>
        </Card>
      </Section>

      {/* ── 2. PRIMARY ACCENT ──────────────────────────────────── */}
      <Section title="2. Primary Accent — Dark Slate" hint="Admin panel uses the same dark-slate primary as the employee panel.">
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PaletteTile name="Primary bg" classes="bg-primary text-primary-foreground" border="border-primary/30" />
            <PaletteTile name="Primary /10" classes="bg-primary/10 text-primary" border="border-primary/20" />
            <PaletteTile name="Primary /5" classes="bg-primary/5 text-primary" border="border-primary/20" />
            <PaletteTile name="Primary text" classes="bg-card text-primary" border="border-border" />
          </CardContent>
        </Card>
      </Section>

      {/* ── 3. STATUS BADGE ────────────────────────────────────── */}
      <Section title="3. StatusBadge — Auto-tone" hint="Same component as employee panel — auto-selects tone from the status string.">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="ACTIVE" />
              <StatusBadge status="PAID" />
              <StatusBadge status="COMPLETED" />
              <StatusBadge status="APPROVED" />
              <StatusBadge status="CONVERTED" />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <StatusBadge status="PENDING" />
              <StatusBadge status="PARTIAL" />
              <StatusBadge status="REQUESTED" />
              <StatusBadge status="SUSPENDED" />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <StatusBadge status="IN_PROGRESS" />
              <StatusBadge status="UNDER_REVIEW" />
              <StatusBadge status="SUBMITTED" />
              <StatusBadge status="ISSUED" />
              <StatusBadge status="PROCESSING" />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <StatusBadge status="REJECTED" />
              <StatusBadge status="OVERDUE" />
              <StatusBadge status="CANCELLED" />
              <StatusBadge status="REFUNDED" />
              <StatusBadge status="EXPIRED" />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <StatusBadge status="LOW" />
              <StatusBadge status="MEDIUM" />
              <StatusBadge status="HIGH" />
              <StatusBadge status="URGENT" />
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ── 4. STAT CARD ───────────────────────────────────────── */}
      <Section title="4. StatCard" hint="KPI card — same as employee panel.">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Total Students"
            value={1248}
            hint="+47 this month"
            icon={<Users className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            title="Active Applications"
            value={312}
            hint="86 in review"
            icon={<FolderKanban className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            title="Monthly Revenue"
            value="$48.2K"
            hint="+12% vs last month"
            icon={<CreditCard className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            title="System Health"
            value="99.9%"
            hint="All systems operational"
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          />
        </div>
      </Section>

      {/* ── 5. EMPTY STATE ─────────────────────────────────────── */}
      <Section title="5. EmptyState" hint="Dashed-border empty state.">
        <EmptyState
          title="No records found"
          description="Try adjusting your filters or add a new record."
          action={<Button size="sm"><Plus className="h-4 w-4" aria-hidden /> Add new</Button>}
        />
      </Section>

      {/* ── 6. TABLE SHELL ─────────────────────────────────────── */}
      <Section title="6. TableShell" hint="Table wrapper with header row.">
        <TableShell headers={["Employee", "Role", "Status", "Last Active"]}>
          <tr className="hover:bg-muted/30">
            <td className="px-4 py-3 font-medium">Alice Chen</td>
            <td className="px-4 py-3">Senior Counselor</td>
            <td className="px-4 py-3"><StatusBadge status="ACTIVE" /></td>
            <td className="px-4 py-3 text-muted-foreground">2 min ago</td>
          </tr>
          <tr className="hover:bg-muted/30">
            <td className="px-4 py-3 font-medium">Bob Patel</td>
            <td className="px-4 py-3">Counselor</td>
            <td className="px-4 py-3"><StatusBadge status="ACTIVE" /></td>
            <td className="px-4 py-3 text-muted-foreground">1 hour ago</td>
          </tr>
          <tr className="hover:bg-muted/30">
            <td className="px-4 py-3 font-medium">Carol Reyes</td>
            <td className="px-4 py-3">Visa Specialist</td>
            <td className="px-4 py-3"><StatusBadge status="SUSPENDED" /></td>
            <td className="px-4 py-3 text-muted-foreground">3 days ago</td>
          </tr>
        </TableShell>
      </Section>

      {/* ── 7. PAGINATION ──────────────────────────────────────── */}
      <Section title="7. Pagination">
        <Card>
          <CardContent>
            <Pagination page={3} totalPages={12} basePath="/admin/students" query={{ role: "STUDENT" }} />
          </CardContent>
        </Card>
      </Section>

      {/* ── 8. BUTTONS ─────────────────────────────────────────── */}
      <Section title="8. Buttons">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button>
              <Plus className="h-4 w-4" aria-hidden /> Primary
            </Button>
            <Button variant="outline">
              <RefreshCw className="h-4 w-4" aria-hidden /> Outline
            </Button>
            <Button variant="ghost">
              <Bell className="h-4 w-4" aria-hidden /> Ghost
            </Button>
            <Button variant="destructive">
              <X className="h-4 w-4" aria-hidden /> Destructive
            </Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </CardContent>
        </Card>
      </Section>

      {/* ── 9. CARDS ───────────────────────────────────────────── */}
      <Section title="9. Cards">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Default card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Standard card with header + content.
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Highlighted card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">For callouts and primary information.</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="text-emerald-600">Success card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">For positive states.</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-red-600">Destructive card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">For errors and destructive actions.</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── 10. INPUTS ─────────────────────────────────────────── */}
      <Section title="10. Form Inputs">
        <Card>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text input</label>
              <Input placeholder="Enter name…" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email input</label>
              <Input type="email" placeholder="name@example.com" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required <span className="text-red-600">*</span></label>
              <Input placeholder="Required field" className="mt-1" required />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disabled</label>
              <Input placeholder="Disabled" className="mt-1" disabled />
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ── 11. ICON-ONLY BUTTONS ──────────────────────────────── */}
      <Section title="11. Icon-only Buttons">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2">
            <button aria-label="Refresh" className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
            <button aria-label="Add" className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Plus className="h-4 w-4" aria-hidden />
            </button>
            <button aria-label="View" className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <button aria-label="Delete" className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-red-600 transition-colors hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500">
              <X className="h-4 w-4" aria-hidden />
            </button>
            <button aria-label="Bell with notification" className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Bell className="h-4 w-4" aria-hidden />
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-card">3</span>
            </button>
          </CardContent>
        </Card>
      </Section>

      {/* ── 12. LINK PATTERNS ──────────────────────────────────── */}
      <Section title="12. Link Patterns">
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Inline link: <Link href="#" className="font-medium text-primary hover:underline">View all employees</Link>
            </p>
            <p className="text-sm">
              Arrow link:{" "}
              <Link href="#" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </p>
            <p className="text-sm">
              Breadcrumb:{" "}
              <Link href="#" className="text-muted-foreground hover:text-foreground">Employees</Link>
              <ChevronRight className="mx-1 inline h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <Link href="#" className="text-muted-foreground hover:text-foreground">Alice Chen</Link>
              <ChevronRight className="mx-1 inline h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span className="text-foreground">Edit</span>
            </p>
            <p className="text-sm">
              Back link:{" "}
              <Link href="#" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Back to list
              </Link>
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <Card className="border-primary/30 bg-primary/5 text-center">
        <CardContent>
          <p className="text-xs text-muted-foreground">
            See <code className="rounded bg-muted px-1 py-0.5 font-mono">APP_DESIGN_SYSTEM.md</code> for the full spec.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
    <div className={`rounded-lg border p-3 text-center ${border}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-lg mx-auto ${classes}`}>
        <span className="text-xs font-bold">A</span>
      </span>
      <p className="mt-2 text-xs font-semibold">{name}</p>
    </div>
  );
}
