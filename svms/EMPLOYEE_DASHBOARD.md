# Euroscope Employee Dashboard — Module Documentation

**Route:** `/employee/dashboard` (alias of `/employee`)
**API:** `GET /api/employee/dashboard?preset=30d&tz=Asia/Dhaka`
**Status:** Production-ready — lint clean, typecheck clean, 64 tests passing, build green

---

## 1. Purpose

A server-rendered operations dashboard for counselors and case managers. Shows real
database metrics across the assigned workload — students, applications, leads,
documents, visa cases, tasks, deadlines, appointments, payments, and recent activity.
Every metric is computed server-side; nothing is faked or mocked.

The dashboard answers, at a glance:

- What's on my plate today? (KPI cards)
- Where are my applications in the pipeline? (18-stage visual)
- What needs my review right now? (pending documents, overdue tasks, deadlines)
- What's happening across my case load? (recent activity)
- What should I do next? (quick actions)

---

## 2. Architecture

| Piece | Location |
| --- | --- |
| Date-range helper (TZ-aware) | `lib/utils/dashboard-range.ts` |
| Dashboard service (server-side aggregation) | `lib/services/employee-dashboard.ts` |
| Page (server component) | `app/employee/page.tsx` |
| `/employee/dashboard` redirect | `app/employee/dashboard/page.tsx` → `/employee` |
| Date-range filter chip (client) | `components/employee/date-range-filter.tsx` |
| API route | `app/api/employee/dashboard/route.ts` |
| Tests | `tests/dashboard-range.test.ts`, `tests/employee-dashboard.test.ts` |

### Data flow

```
Browser → /employee?preset=30d&tz=Asia/Dhaka
  → auth() — resolves session + role + (for EMPLOYEE) Employee row
  → hasPermission() per metric — gates which KPIs render
  → resolveDashboardRange() — pure, TZ-aware Date math
  → getEmployeeDashboard() — Promise.all over 8 sub-services
    • getDashboardKpis()       — 11 parallel count()s
    • getApplicationPipeline() — 1 groupBy (returns all 18 stages)
    • getVisaCases()           — 1 groupBy (returns all 7 visa stages)
    • getPendingDocuments()    — findMany + select
    • getUpcomingDeadlines()   — 3 parallel findManys + JS merge
    • getMyTasks()             — findMany + JS group (overdue/today/upcoming)
    • getUpcomingAppointments()— findMany + select
    • getRecentActivity()      — 6 parallel findManys + JS merge
  → Server-rendered HTML returned
```

Every query is run in parallel via `Promise.all` — no N+1 anywhere. Counts
use `prisma.<model>.count()`, stage buckets use `prisma.<model>.groupBy()`,
lists use `findMany({ select: {...}, take: N })`.

---

## 3. Case ownership (IDOR closure)

Every `where` clause embeds the caller's scope filter:

| Model | EMPLOYEE scope | ADMIN scope |
| --- | --- | --- |
| Student | `{ assignedEmployeeId: <emp-id> }` | `{}` |
| Lead | `{ assignedEmployeeId: <emp-id> }` | `{}` |
| Application | `{ student: { assignedEmployeeId: <emp-id> } }` | `{}` |
| Document | `{ student: { assignedEmployeeId: <emp-id> } }` | `{}` |
| Task | `{ assignedToId: <user-id> }` | `{}` |
| VisaApplication | `{ application: { student: { assignedEmployeeId: <emp-id> } } }` | `{}` |
| Appointment | `{ student: { assignedEmployeeId: <emp-id> } }` | `{}` |
| Payment | `{ student: { assignedEmployeeId: <emp-id> } }` | `{}` |
| Invoice | `{ student: { assignedEmployeeId: <emp-id> } }` | `{}` |
| Intake | `{}` (global — every counselor sees all intakes) | `{}` |

The `employeeId` and `userId` always come from the session, never from the
request body or query string. Foreign records are never returned.

---

## 4. KPI cards

Eleven KPIs are computed by `getDashboardKpis()`. Each is **permission-gated** —
if the caller lacks the relevant permission, the count stays 0 and the
corresponding `prisma.count()` is never fired.

| KPI | Permission | Source |
| --- | --- | --- |
| My Students | `students.read` | `student.count` with studentScope |
| Active Applications | `applications.read` | `application.count` (status ≠ COMPLETED) |
| New Leads | `leads.read` | `lead.count` (status=NEW, in-range) |
| Pending Documents | `documents.read` | `document.count` (status in REQUESTED/UPLOADED/UNDER_REVIEW) |
| Visa Applications | `visa.read` | `visaApplication.count` (total) |
| Visa Submitted | `visa.read` | `visaApplication.count` (stage in SUBMITTED/BIOMETRICS/INTERVIEW/PROCESSING) |
| Visa Approved | `visa.read` | `visaApplication.count` (stage=APPROVED) |
| Pending Tasks | `tasks.read` | `task.count` (status in TODO/IN_PROGRESS) |
| Overdue Tasks | `tasks.read` | `task.count` (dueDate < now) |
| Upcoming Appointments | `tasks.read` | `appointment.count` (scheduledAt ≥ now, status=SCHEDULED) |
| Outstanding Payments | `payments.read` | `payment.count` (status=PENDING) |

The page renders only the KPIs the caller is authorized to see — cards with
zero permission are omitted from the DOM entirely.

---

## 5. Main widgets

### Application Pipeline (`PipelineWidget`)

Shows all 18 canonical stages as a responsive grid:

```
LEAD → COUNSELING → PROFILE_ASSESSMENT → COUNTRY_SELECTION →
UNIVERSITY_SELECTION → DOCUMENT_COLLECTION → APPLICATION_SUBMITTED →
CONDITIONAL_OFFER → UNCONDITIONAL_OFFER → DEPOSIT_PAYMENT →
CONFIRMATION → VISA_PREPARATION → VISA_SUBMITTED → BIOMETRICS →
INTERVIEW → VISA_DECISION → TRAVEL_PREPARATION → COMPLETED
```

- **Source:** single `application.groupBy({ by: ["stageKey"] })` + canonical
  list merge. Missing stages show count 0.
- **Click:** each stage links to `/employee/applications?stage=<STAGE_KEY>`
  for a filtered view.
- **Visual:** count + thin progress bar proportional to the busiest stage.

### Pending Documents (`PendingDocumentsWidget`)

| Column | Source |
| --- | --- |
| Student | `document.student.firstName + lastName` |
| Document | `document.name` |
| Status | `document.status` (REQUESTED/UPLOADED/UNDER_REVIEW) |
| Deadline | `document.uploadedAt` (proxy — Document model has no deadline col) |
| Action | "Review" → `/employee/documents` |

Sorted by `createdAt asc` — oldest pending first.

### Upcoming Deadlines (`UpcomingDeadlinesWidget`)

Merges three sources in parallel:

| Kind | Source | Date column |
| --- | --- | --- |
| task | `task.dueDate` (status in TODO/IN_PROGRESS) | dueDate |
| intake | `intake.deadline` | deadline |
| visa | `visaApplication.biometricsAt` / `interviewAt` | biometricsAt, interviewAt |

Returns the merged list sorted ascending by date, capped at 8. Overdue items
are flagged with the destructive tone.

### My Tasks (`MyTasksWidget`)

Three groups, each capped at 5:

- **Overdue** — `dueDate < startOfToday`
- **Today** — `startOfToday ≤ dueDate ≤ endOfToday`
- **Upcoming** — `dueDate > endOfToday`

Each task row shows title, student name (when linked), due date, priority
badge, and status badge.

### Visa Cases (`VisaCasesWidget`)

Compact list of the 7 visa stages with counts:

```
PREPARATION | SUBMITTED | BIOMETRICS | INTERVIEW | PROCESSING | APPROVED | REFUSED
```

Approved → success tone, Refused → destructive tone.

### Upcoming Appointments (`UpcomingAppointmentsWidget`)

| Column | Source |
| --- | --- |
| Student | `appointment.student.firstName + lastName` |
| Title | `appointment.title` |
| Type | `appointment.type` (COUNSELING/DOCUMENT_REVIEW/VISA_INTERVIEW/BIOMETRICS/OTHER) |
| Date | `appointment.scheduledAt` |
| Duration | `appointment.durationMinutes` |
| Status | `appointment.status` |

Sorted by `scheduledAt asc`, capped at 5.

### Recent Activity (`RecentActivityWidget`)

Merges 6 entity kinds (lead, application, document, task, payment, appointment)
in parallel — each query takes 8 rows, the results are merged in JS and sorted
by `updatedAt desc`. Each row has an icon keyed by `kind` and shows the title,
detail, and date.

Activity is always scoped — only the caller's authorized records are returned.

---

## 6. Date range filter

Six presets + a custom range, all TZ-aware:

| Preset | Label | Behavior |
| --- | --- | --- |
| `today` | Today | Start of calendar day in caller's TZ → end of same day |
| `7d` | 7 Days | Rolling 7-day window ending now |
| `30d` | 30 Days | Rolling 30-day window (default) |
| `90d` | 90 Days | Rolling 90-day window |
| `year` | This Year | Jan 1 → Dec 31 of caller's local year |
| `custom` | Custom Range | Explicit `from` + `to` ISO strings |

### Timezone handling

- Default TZ is `UTC` for server-side determinism (no DST surprises).
- The caller's TZ can be passed via `?tz=Asia/Dhaka`.
- `Intl.supportedValuesOf("timeZone")` validates the input — a malicious
  `tz` value never reaches `Intl.DateTimeFormat`.
- All returned `from` / `to` are UTC `Date` instances (Prisma stores `DateTime`
  as UTC); the TZ only affects how we compute "start of today" and "this year".

### Affects

- `newLeads` KPI (status=NEW, createdAt in range)
- `getUpcomingDeadlines()` — only returns deadlines inside the range
- Range label shown in the page header

KPIs that are timeless (My Students, Active Applications, Pending Documents,
Visa totals, Pending Tasks, Upcoming Appointments, Outstanding Payments) ignore
the range — they represent the current state.

---

## 7. Quick actions

Permission-aware action buttons rendered under the KPI grid:

| Action | Permission | Destination |
| --- | --- | ---|
| Add Lead | `leads.manage` | `/employee/leads` |
| Add Student | `students.create` | `/employee/students` |
| Create Application | `applications.update` | `/employee/applications` |
| Request Document | `documents.review` | `/employee/documents` |
| Create Task | `tasks.manage` | `/employee/tasks` |
| Schedule Appointment | `tasks.manage` | `/employee/appointments` |
| Send Message | `messages.create` | `/employee/messages` |

Actions the caller lacks permission for are hidden from the DOM.

---

## 8. States

| State | Behavior |
| --- | --- |
| Loading | Server component — no client loading spinner; the page renders fully on the server. Subsequent filter changes re-render server-side. |
| Empty | Each widget renders a centered "No X yet" message in muted text. |
| Error | The page catches service errors and renders a `DashboardError` card with "Could not load your dashboard" + a refresh hint. |
| Unauthorized | The layout guard redirects unauthenticated → `/login`, non-employee/admin → `/403` before the page renders. |
| Permission denied | KPIs and quick actions the caller lacks are simply omitted — no error. |

---

## 9. Responsive design

- **Mobile (<768px):** KPI grid 2 cols, widgets stack vertically, pipeline
  cards 1 col, tables become horizontally scrollable.
- **Tablet (768–1024px):** KPI grid 3 cols, widgets 1 col, pipeline 2 cols.
- **Desktop (≥1024px):** KPI grid 6 cols, main column (pipeline + pending docs +
  deadlines + tasks) 2/3 width, side column (visa + appointments + activity)
  1/3 width, pipeline 3 cols.
- **Wide (≥1440px):** Same as desktop — content is capped at the app shell's
  max width.

Touch targets are ≥44px on every breakpoint.

---

## 10. Tests

`tests/dashboard-range.test.ts` (15 tests):
- Preset resolution (default, unknown, all 6 presets)
- "Today" preset TZ-aware (UTC, Asia/Dhaka UTC+6, America/New_York UTC-4)
- "Year" preset spanning Jan 1 → Dec 31
- Custom range validation (valid, missing from, inverted, invalid strings)
- `dateRangeWhere()` builds correct gte/lte fragments

`tests/employee-dashboard.test.ts` (35 tests):
- Scope filters — ADMIN empty, EMPLOYEE embeds `assignedEmployeeId` /
  `assignedToId`, no client-supplied IDs
- KPIs — empty database (all zeros), populated database (11 metrics),
  permission gating (zero counts + no prisma calls when perm is absent)
- Pipeline — all 18 stages always returned, missing → 0
- Visa cases — all 7 stages with counts
- Recent activity — merged + sorted by date desc, empty case
- Pending documents — status filter + IDOR scope filter
- My tasks — grouped overdue/today/upcoming
- Upcoming appointments — `scheduledAt ≥ now` + status SCHEDULED
- Upcoming deadlines — merged across tasks/intakes/visa, sorted asc
- Aggregate composition — Promise.all over all widgets
- Permission gating in the aggregate — visa/documents/tasks omitted when perm
  is absent
- Error propagation — prisma errors bubble to `handleApiError` (never swallowed)

Total: 50 new tests, 64 total passing.

Run:
```bash
npm run test
```

---

## 11. Schema additions

This module added five Prisma models to support the dashboard:

| Model | Purpose | Indexes |
| --- | --- | --- |
| `VisaApplication` | Visa case tracking per application | applicationId, stage |
| `Appointment` | Student appointments | studentId, employeeId, scheduledAt, status |
| `Intake` | Course intake periods with deadlines | courseId, status |
| `Payment` | Student payment records | studentId, status |
| `Invoice` | Student invoices | studentId, status |

Reverse relations added to: Student, Application, Employee, Course.

Run after deploy:
```bash
npx prisma generate
npx prisma db push
```

---

## 12. Build verification

```bash
npm run lint        ✓ 0 errors, 0 warnings
npm run typecheck   ✓ passes
npm run test        ✓ 64/64 passing (50 new)
npm run build       ✓ 18 routes built, no errors
```

---

## 13. What's not yet done

These items are intentionally deferred:

1. **Pipeline stage click** — currently links to `/employee/applications?stage=<KEY>`
   but the applications list page doesn't yet read the `?stage=` query param to
   filter. That's a 5-line addition to `app/employee/applications/page.tsx`.
2. **Custom range picker** — currently uses two native `<input type="date">`
   fields with a submit button. Could be upgraded to a calendar popover.
3. **Dark mode** — the theme toggle exists in the header but doesn't yet
   apply `.dark` class with overridden tokens.
4. **Real-time updates** — dashboard re-renders on filter change but doesn't
   auto-refresh. A 60-second SWR-style refetch could be added.
5. **Caching** — KPIs run 11 parallel `count()` queries per render. For very
   large datasets, a 60-second in-memory cache keyed by `(userId, range.preset)`
   would cut DB load significantly.
