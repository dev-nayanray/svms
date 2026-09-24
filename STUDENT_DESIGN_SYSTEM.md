# Student Panel — Design System

This document catalogs the shared design tokens, color palette, and
reusable components for the Euroscope student panel. **All new student
UI work should pull from these primitives — do not invent ad-hoc
styles.**

If you need a pattern that isn't here, add it to `components/student/ui.tsx`
first, then use it. The goal is one shared visual language across every
student-facing page.

---

## 1. Where things live

| Artifact | Location |
|---|---|
| Shared components + `STUDENT_TOKENS` constant | `components/student/ui.tsx` |
| App shell (header, bottom nav, sidebar, more-sheet) | `components/student/app-shell.tsx` |
| Online-status hook | `lib/hooks/use-online-status.ts` |
| Stagger animation CSS | `app/globals.css` (`.stagger-children`) |
| Page-level animations | `app/globals.css` (`.app-page-enter`) |

---

## 2. Brand accent — amber / gold

The Euroscope brand identity is the laurel wreath (gold). The student
panel uses **amber-500 / amber-600** as the primary accent everywhere:

- Active nav tab indicator: `bg-amber-500`
- Active filter chip: `bg-gradient-to-br from-amber-500 to-amber-600`
- CTA buttons: `bg-gradient-to-br from-amber-500 to-amber-600 text-white`
- Section icon containers: `bg-amber-500/10 text-amber-600`
- Section group headers: `bg-gradient-to-b from-amber-400 to-amber-600`
- Focus rings: `focus-visible:outline-amber-500`
- "View all" links: `text-amber-600 hover:text-amber-700`

**Never** use `bg-primary` / `text-primary` / `outline-primary` in
student-facing code — those tokens belong to the marketing site and
default to a non-gold color. Always use the explicit amber classes.

---

## 3. Color palette

The student panel uses **explicit Tailwind colors** instead of semantic
CSS variables (`--success`, `--warning`, etc.) for cross-theme
consistency. Use these mappings:

| Tone | Background | Text | Border (subtle) | Border (card) |
|---|---|---|---|---|
| Success | `bg-emerald-500/10` | `text-emerald-600` | `border-emerald-300/60` | `bg-emerald-50/40 dark:bg-emerald-950/10` |
| Warning | `bg-amber-500/10` | `text-amber-600` | `border-amber-300/60` | `bg-amber-50/40 dark:bg-amber-950/10` |
| Info | `bg-blue-500/10` | `text-blue-600` | `border-blue-300/60` | `bg-blue-50/40 dark:bg-blue-950/10` |
| Destructive | `bg-red-500/10` | `text-red-600` | `border-red-300/60` | `bg-red-50/40 dark:bg-red-950/10` |
| Default | `bg-muted` | `text-muted-foreground` | `border-border/60` | `bg-card` |

**Forbidden in student code:**
- `bg-success`, `bg-warning`, `bg-info`, `bg-destructive`
- `text-success`, `text-warning`, `text-info`, `text-destructive`
- `border-success/`, `border-warning/`, `border-info/`, `border-destructive/`
- `bg-primary`, `text-primary`, `border-primary`, `outline-primary`
- `bg-primary text-primary-foreground` (use the amber gradient instead)

**Exception:** `text-destructive` and `hover:bg-destructive/10` may be
used on destructive confirmation buttons (Cancel, Withdraw, Delete,
Log out) — this matches the broader app convention.

---

## 4. Design tokens (`STUDENT_TOKENS`)

The `STUDENT_TOKENS` constant in `components/student/ui.tsx` is the
single source of truth for the most common style combinations. Import
and use them — don't hardcode the same Tailwind strings.

```tsx
import { STUDENT_TOKENS } from "@/components/student/ui";

<div className={STUDENT_TOKENS.card}>...</div>
<a className={STUDENT_TOKENS.viewAllLink}>View all →</a>
<button className={STUDENT_TOKENS.ctaPrimary}>Save</button>
```

| Token | Use case |
|---|---|
| `STUDENT_TOKENS.card` | Card surface — `rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200` |
| `STUDENT_TOKENS.cardHover` | Add to tappable cards — `hover:border-amber-300/60 hover:shadow-md active:scale-[0.98]` |
| `STUDENT_TOKENS.ctaPrimary` | Primary CTA button — amber gradient |
| `STUDENT_TOKENS.ctaGhost` | Secondary button — ghost style |
| `STUDENT_TOKENS.sectionLabel` | Small uppercase muted label — `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` |
| `STUDENT_TOKENS.viewAllLink` | "View all →" link — `text-amber-600` |
| `STUDENT_TOKENS.statusDot` | Status dot base — `h-1.5 w-1.5 rounded-full` |

---

## 5. Shared components

All in `components/student/ui.tsx`. Import what you need:

```tsx
import {
  MobilePage, MobileCard,
  StudentSection, StudentStatCard, StudentEmptyState,
  StudentErrorState, StatusBadge, FilterChip, PageHeader,
  ProgressCard, QuickAction, Timeline,
  NotificationBadge, LoadingCards,
} from "@/components/student/ui";
```

### Layout

#### `MobilePage`
Page wrapper. Applies `max-w-lg` (512px) for large-screen utilization,
`space-y-5` vertical rhythm, `pb-24` for bottom-nav clearance on
mobile.

```tsx
<MobilePage>{children}</MobilePage>
```

#### `MobileCard`
Unified card surface. Uses `STUDENT_TOKENS.card`. When `href` is
provided, automatically adds hover lift + active scale.

```tsx
<MobileCard>...</MobileCard>
<MobileCard as="link" href="/student/documents" className="flex items-center gap-3 p-3">
  ...
</MobileCard>
```

### Sections & headers

#### `StudentSection`
Section wrapper with header row (label + optional "View all →" link).
Body uses `space-y-2` by default; override with `bodyClassName`.

```tsx
<StudentSection
  label="Documents"
  viewAllHref="/student/documents"
  bodyClassName="grid grid-cols-5 gap-2"
>
  {statCards}
</StudentSection>
```

#### `PageHeader`
Page title row with optional icon, badge, and action button.

```tsx
<PageHeader
  title="My Documents"
  subtitle="Upload, preview, and track your documents."
  icon={<FileText className="h-5 w-5" aria-hidden />}
  badge={<StatusBadge tone="info">{count} total</StatusBadge>}
/>
```

### State components

#### `StudentEmptyState`
Dashed-border empty state with centered icon + title + description +
optional action. Use for "no data" cases.

```tsx
<StudentEmptyState
  icon={<FileText className="h-5 w-5" aria-hidden />}
  title="No documents here"
  description="Upload your first document to get started."
  action={<Button>Upload</Button>}
/>
```

#### `StudentErrorState`
Unified error/offline card with amber retry CTA. Pass `online={false}`
to show the offline variant. **Replaces every ad-hoc "Couldn't load X"
card.**

```tsx
<StudentErrorState
  online={online}
  title={!online ? "You're offline" : "Couldn't load your documents"}
  description={!online ? "Check your connection and try again." : "Please try again in a moment."}
  onRetry={() => query.refetch()}
/>
```

### Badges & chips

#### `StatusBadge`
Unified status pill. Tones: `default`, `success`, `warning`,
`destructive`, `info`. **Replaces `Badge` from `@/components/ui`
everywhere in student code.**

```tsx
<StatusBadge tone="success">Paid</StatusBadge>
<StatusBadge tone="destructive">{unreadCount}</StatusBadge>
<StatusBadge>{itemCount}</StatusBadge>
```

#### `FilterChip`
Unified filter pill with amber gradient active state. Optional count
badge appears when active.

```tsx
<FilterChip active={isActive} onClick={() => setFilter(value)}>
  {label}
</FilterChip>

<FilterChip active={isActive} onClick={...} count={unreadCount}>
  Unread
</FilterChip>
```

### Stats

#### `StudentStatCard`
KPI tile with tone variants. Optional `href` makes it tappable.

```tsx
<StudentStatCard
  icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
  value={docSummary.approved}
  label="Approved"
  tone="success"
  href="/student/documents"
/>
```

### Specialized

#### `ProgressCard`
Progress card with gradient bar + percentage badge.

#### `QuickAction`
Quick action tile with gold icon container.

#### `Timeline`
Visual timeline with done/current/pending dots.

#### `NotificationBadge`
Red unread count badge with ping animation.

#### `LoadingCards`
Skeleton grid with premium shimmer.

---

## 6. Hooks

### `useOnlineStatus`
Tracks `navigator.onLine`. Use in every view file that fetches data, to
swap the error card for an offline variant.

```tsx
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

const online = useOnlineStatus();
```

The hook is server-safe (initial value `true` to avoid hydration
mismatch; corrects on mount).

---

## 7. Animations

### Page enter
`<main>` in `app-shell.tsx` has `app-page-enter` — fades + slides up
on route change.

### Stagger children
Apply `stagger-children` to a parent to animate direct children with a
50ms incremental delay (up to 8 children). Respects
`prefers-reduced-motion`.

```tsx
<div className="stagger-children space-y-5">
  <Card1 />
  <Card2 />
  <Card3 />
</div>
```

Used on the dashboard to reveal the 3 groups (Today / Progress / Quick
Access) with hierarchy.

---

## 8. Mobile-first layout

The student panel is mobile-first:

- **Bottom nav:** 60px tall, 5 tabs (Home / Documents / Messages /
  More), each ≥ 44px touch target. Top accent bar (amber, 32px wide)
  on the active tab.
- **Content max width:** `max-w-lg` (512px) — better large-phone usage
  than the typical `max-w-md` (448px).
- **Page bottom padding:** `pb-24` (96px) — clears the 60px bottom nav
  with breathing room.
- **Card padding:** `p-4` (16px) standard, `p-3` (12px) for compact
  list rows.
- **Card radius:** `rounded-2xl` (cards), `rounded-xl` (inputs,
  buttons, tiles), `rounded-lg` (small badges).
- **Section spacing:** `space-y-5` between top-level groups, `space-y-2`
  between items inside a section.

---

## 9. Typography

- **Page title** (`PageHeader`): `text-base font-bold tracking-tight`
- **Section label** (`STUDENT_TOKENS.sectionLabel`):
  `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`
- **Card title:** `text-sm font-bold tracking-tight`
- **Body text:** `text-sm` (default), `text-xs` for meta
- **Numeric displays:** always add `tabular-nums` for alignment
  (money, counts, percentages, dates)

---

## 10. Accessibility

- All interactive elements use `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500`
- Touch targets are ≥ 44×44px (`min-h-[44px]` or `min-h-[40px]` for
  compact buttons)
- Color is never the only signal — always pair with text or icon
- `aria-label` on icon-only buttons
- `aria-current="page"` on active nav items
- `role="progressbar"` with `aria-valuenow` / `aria-valuemin` /
  `aria-valuemax` on progress bars
- Reduced motion: all animations respect `prefers-reduced-motion`

---

## 11. Migration checklist for new pages

When adding a new student page:

- [ ] Wrap content in `<MobilePage>`
- [ ] Use `<StudentSection>` for sectioned content (not raw `<section>`)
- [ ] Use `<MobileCard>` for cards (not raw `<div className="rounded-2xl border">`)
- [ ] Use `<StudentErrorState>` for error/offline state
- [ ] Use `<StudentEmptyState>` for empty state
- [ ] Use `<FilterChip>` for filter/tab rows
- [ ] Use `<StatusBadge>` instead of `Badge` from `@/components/ui`
- [ ] Use `STUDENT_TOKENS.card` / `.ctaPrimary` / `.sectionLabel` for
      common patterns
- [ ] Use explicit Tailwind colors (emerald/amber/blue/red), never
      semantic CSS variables
- [ ] Use `text-amber-600` for primary accents, not `text-primary`
- [ ] Use `focus-visible:outline-amber-500`, not `outline-primary`
- [ ] Add `tabular-nums` to numeric displays
- [ ] Import `useOnlineStatus` from `@/lib/hooks/use-online-status`
      (don't redefine it locally)
- [ ] Verify `npx tsc --noEmit` passes
- [ ] Verify `npx eslint <file>` passes
