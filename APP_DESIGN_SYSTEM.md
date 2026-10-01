# Euroscope App — Design System

This document catalogs the shared design tokens, color palette, and
reusable components across **all three panels** of the Euroscope app:
student, employee, and admin. **All new UI work should pull from these
primitives — do not invent ad-hoc styles.**

If you need a pattern that isn't here, add it to the relevant
`ui.tsx` first, then use it. The goal is one shared visual language
per panel, with status colors that are consistent across the entire app.

> **Live previews:**
> - Student panel: [`/student/design-preview`](/student/design-preview)
> - Employee panel: [`/employee/design-preview`](/employee/design-preview)
> - Admin panel: [`/admin/design-preview`](/admin/design-preview)

---

## 1. Three panels, one app

The Euroscope app has three role-based panels. Each has its own primary
accent, but they share the same status color system.

| Panel | Routes | Primary accent | Audience | Tone |
|---|---|---|---|---|
| **Student** | `/student/*` | Amber / gold (`#f59e0b`) | Customers (students) | Warm, premium, brand-forward |
| **Employee** | `/employee/*` | Dark slate (`#1e293b`) | Internal staff | Professional, serious |
| **Admin** | `/admin/*` | Dark slate (`#1e293b`) | Internal admins | Professional, serious |

**Why two different primary accents?**
- The student panel is the customer-facing product. The amber/gold
  matches the Euroscope laurel-wreath brand identity and feels premium.
- The employee/admin panels are internal tools. Dark slate reads as
  "serious / professional" — the same convention used by Linear,
  Stripe Dashboard, and Notion admin. Mixing amber CTAs into the
  existing dark-slate sidebar would create visual dissonance.

---

## 2. Where things live

### Student panel
| Artifact | Location |
|---|---|
| Shared components + `STUDENT_TOKENS` | `components/student/ui.tsx` |
| App shell | `components/student/app-shell.tsx` |
| `useOnlineStatus` hook | `lib/hooks/use-online-status.ts` |
| Stagger animation CSS | `app/globals.css` (`.stagger-children`) |
| Detailed docs | [`STUDENT_DESIGN_SYSTEM.md`](./STUDENT_DESIGN_SYSTEM.md) |

### Employee + Admin panels (shared)
| Artifact | Location |
|---|---|
| Shared components (`StatCard`, `EmptyState`, `TableShell`, `Pagination`, `StatusBadge`) | `components/shared/index.tsx` |
| App shell | `components/shared/admin-shell.tsx` |
| Sidebar shell | `components/shared/sidebar-shell.tsx` |
| Data table | `components/shared/data-table.tsx` |
| Page kit (form helpers) | `components/shared/page-kit.tsx` |
| Nav config | `config/navigation.ts` (employee) / `config/admin-navigation.ts` |

---

## 3. Status color system — shared across all panels

All three panels use the **same explicit Tailwind colors** for status
indicators. Do not use semantic CSS variables (`--success`,
`--warning`, `--info`, `--destructive`) — use the explicit Tailwind
classes instead. This ensures cross-theme consistency.

| Tone | Background | Text | Border (subtle) | Border (card) |
|---|---|---|---|---|
| Success | `bg-emerald-500/10` | `text-emerald-600` | `border-emerald-500/20` | `border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/10` |
| Warning | `bg-amber-500/10` | `text-amber-600` | `border-amber-500/20` | `border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10` |
| Info | `bg-blue-500/10` | `text-blue-600` | `border-blue-500/20` | `border-blue-300/60 bg-blue-50/40 dark:bg-blue-950/10` |
| Destructive | `bg-red-500/10` | `text-red-600` | `border-red-500/20` | `border-red-300/60 bg-red-50/40 dark:bg-red-950/10` |
| Default | `bg-muted` | `text-muted-foreground` | `border-border` | `bg-card` |

### Forbidden
- `bg-success`, `bg-warning`, `bg-info`, `bg-destructive` (use `bg-emerald-500`, etc.)
- `text-success`, `text-warning`, `text-info`, `text-destructive`
- `border-success/`, `border-warning/`, `border-info/`, `border-destructive/`

### Exception
`text-destructive` and `hover:bg-destructive/10` may be used on
destructive confirmation buttons (Cancel, Withdraw, Delete, Log out) —
this matches the broader app convention.

---

## 4. Primary accent — per panel

### Student panel — amber / gold

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
student-facing code — those tokens belong to the employee/admin panels
and default to dark slate. Always use the explicit amber classes.

### Employee + Admin panels — dark slate

The internal panels use **dark slate** (`--primary = #1e293b`) as the
primary accent. Use the `primary` semantic tokens freely here:

- `bg-primary text-primary-foreground` for CTA buttons
- `text-primary` for link text and icon accents
- `bg-primary/10 text-primary` for icon containers and active states
- `border-primary/30` for highlighted cards
- `hover:bg-primary-hover` for button hovers
- `focus-visible:outline-primary` for focus rings

This is intentional — the dark slate reads as "serious / professional"
for internal tools.

---

## 5. Shared components — student panel

All in `components/student/ui.tsx`. See
[`STUDENT_DESIGN_SYSTEM.md`](./STUDENT_DESIGN_SYSTEM.md) for the full
catalog with usage examples:

- `MobilePage`, `MobileCard` — layout
- `StudentSection`, `PageHeader` — sections + headers
- `StudentEmptyState`, `StudentErrorState` — state components
- `StatusBadge`, `FilterChip` — badges + chips
- `StudentStatCard`, `ProgressCard`, `QuickAction`, `Timeline` — specialized
- `NotificationBadge`, `LoadingCards` — feedback
- `STUDENT_TOKENS` — design token constant

---

## 6. Shared components — employee + admin panels

All in `components/shared/index.tsx`. Import what you need:

```tsx
import { StatCard, EmptyState, TableShell, Pagination, StatusBadge } from "@/components/shared";
```

### `StatCard`
KPI card with title, value, optional hint, optional icon.

```tsx
<StatCard
  title="Active Students"
  value={42}
  hint="+3 this week"
  icon={<Users className="h-4 w-4" aria-hidden />}
/>
```

### `EmptyState`
Dashed-border empty state with title, description, optional action.

```tsx
<EmptyState
  title="No applications yet"
  description="Applications will appear here once students submit them."
  action={<Button>Refresh</Button>}
/>
```

### `TableShell`
Table wrapper with header row + empty state.

```tsx
<TableShell headers={["Name", "Status", "Created"]}>
  {rows.map((r) => <tr key={r.id}>...</tr>)}
</TableShell>
```

### `Pagination`
Previous / Next pagination with page count.

```tsx
<Pagination page={2} totalPages={5} basePath="/employee/students" query={{ status: "ACTIVE" }} />
```

### `StatusBadge`
**Status pill with built-in status → tone mapping.** Pass a raw status
string (e.g. `"PAID"`, `"PENDING"`, `"OVERDUE"`) and it auto-selects
the right tone. Used across every employee + admin table.

```tsx
<StatusBadge status="PAID" />        {/* → emerald */}
<StatusBadge status="PENDING" />     {/* → amber */}
<StatusBadge status="OVERDUE" />     {/* → red */}
<StatusBadge status="IN_PROGRESS" /> {/* → blue */}
```

The full status → tone mapping is in `components/shared/index.tsx`
(`STATUS_TONES` constant, ~40 statuses covered).

---

## 7. App shells

### Student shell — `components/student/app-shell.tsx`
- Mobile-first: sticky header + bottom tab nav (60px)
- Desktop: header + left sidebar (260px)
- Glassmorphism (`backdrop-blur-xl`)
- Bottom-sheet "More" menu for secondary nav
- Global search overlay (Cmd+K)
- Live SSE indicator (online/reconnecting/offline)

### Employee + Admin shell — `components/shared/admin-shell.tsx`
- Desktop-first: top header + left sidebar (260px)
- Sidebar groups (e.g. "Workspace", "Management", "System")
- Active item: left accent bar + tinted background
- Notification bell with unread count
- User dropdown menu in header

---

## 8. Animations

### Page enter
`<main>` in all shells has `app-page-enter` — fades + slides up on
route change.

### Stagger children (student panel)
Apply `stagger-children` to a parent to animate direct children with a
50ms incremental delay (up to 8 children). Respects
`prefers-reduced-motion`. Defined in `app/globals.css`.

```tsx
<div className="stagger-children space-y-5">
  <Card1 />
  <Card2 />
  <Card3 />
</div>
```

---

## 9. Typography

- **Page title:** `text-2xl font-bold tracking-tight` (admin/employee),
  `text-base font-bold tracking-tight` (student, via `PageHeader`)
- **Section label:** `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`
- **Card title:** `text-sm font-bold tracking-tight` (student),
  `text-base font-semibold` (admin/employee)
- **Body text:** `text-sm` (default), `text-xs` for meta
- **Numeric displays:** always add `tabular-nums` for alignment
  (money, counts, percentages, dates)

---

## 10. Accessibility

- All interactive elements use `focus-visible:outline-2 focus-visible:outline-offset-2`
  - Student panel: `outline-amber-500`
  - Employee/admin: `outline-primary`
- Touch targets are ≥ 44×44px on mobile (`min-h-[44px]`)
- Color is never the only signal — always pair with text or icon
- `aria-label` on icon-only buttons
- `aria-current="page"` on active nav items
- `role="progressbar"` with `aria-valuenow` / `aria-valuemin` /
  `aria-valuemax` on progress bars
- Reduced motion: all animations respect `prefers-reduced-motion`

---

## 11. Migration checklist for new pages

### Student pages
- [ ] Wrap content in `<MobilePage>`
- [ ] Use `<StudentSection>` for sectioned content
- [ ] Use `<MobileCard>` for cards
- [ ] Use `<StudentErrorState>` for error/offline state
- [ ] Use `<StudentEmptyState>` for empty state
- [ ] Use `<FilterChip>` for filter/tab rows
- [ ] Use `<StatusBadge>` from `@/components/student/ui` (not `Badge`)
- [ ] Use `STUDENT_TOKENS.card` / `.ctaPrimary` / `.sectionLabel`
- [ ] Use explicit Tailwind colors (emerald/amber/blue/red), never
      semantic CSS variables
- [ ] Use `text-amber-600` for primary accents, not `text-primary`
- [ ] Use `focus-visible:outline-amber-500`, not `outline-primary`
- [ ] Add `tabular-nums` to numeric displays
- [ ] Import `useOnlineStatus` from `@/lib/hooks/use-online-status`
- [ ] Verify `npx tsc --noEmit` + `npx eslint <file>` pass

### Employee + Admin pages
- [ ] Use `<StatCard>`, `<EmptyState>`, `<TableShell>`, `<Pagination>`
      from `@/components/shared`
- [ ] Use `<StatusBadge status="...">` for status pills (auto-tone)
- [ ] Use explicit Tailwind colors for status (emerald/amber/blue/red),
      never `--success` / `--warning` / `--info` / `--destructive`
- [ ] Use `bg-primary` / `text-primary` freely for the primary accent
      (dark slate is intentional for internal tools)
- [ ] Add `tabular-nums` to numeric displays
- [ ] Verify `npx tsc --noEmit` + `npx eslint <file>` pass

---

## 12. Related documents

- [`STUDENT_DESIGN_SYSTEM.md`](./STUDENT_DESIGN_SYSTEM.md) — detailed
  student panel reference (tokens, components, mobile-first layout)
- [`/student/design-preview`](/student/design-preview) — live preview
- [`/employee/design-preview`](/employee/design-preview) — live preview
- [`/admin/design-preview`](/admin/design-preview) — live preview
