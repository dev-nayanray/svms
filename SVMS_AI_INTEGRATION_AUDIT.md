# SVMS — Technical Audit & AI Integration Architecture Report

**Author:** Senior AI Architect, Senior Full-Stack Engineer, SaaS Security Engineer
**Date:** 2026-10-01
**Project:** Euroscope SVMS (Student Visa Management System)
**Method:** Zero-modification deep audit. Every finding is grounded in the actual codebase — no invented files, APIs, tables, or technologies.

---

## Executive Summary

Euroscope SVMS is a production-grade Next.js 16 monolith built on MongoDB + Prisma 6, with NextAuth v5 (JWT, 8-hour sessions), a centralized RBAC layer (~80 permission keys across 3 roles), an in-process SSE event bus for real-time student updates, a 165-route REST API surface, and a 29-file service layer (~8,800 lines of business logic). The app ships three role-based panels (student, employee, admin) plus a marketing site, with a unified design system documented in `APP_DESIGN_SYSTEM.md`.

**On "Hermes API":** There is NO Hermes API, Hermes agent, or Hermes messaging framework anywhere in this project. The only "hermes" reference in the lockfile is `hermes-parser` — a JavaScript parser used by `eslint-plugin-react-hooks`. Hermes is not integrated, not configured, and not depended on. Any AI assistant integration must be built from scratch using a real LLM provider (OpenAI / Anthropic / Vertex AI / Azure OpenAI). This report recommends an architecture for doing exactly that — safely, incrementally, and without breaking the existing SVMS.

---

## 1. Current Architecture

### High-level shape
```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 16 Monolith                     │
│  (App Router, Turbopack, React 19, TypeScript 5, Node.js)   │
├─────────────────────────────────────────────────────────────┤
│  proxy.ts (edge)  →  layout guards  →  page guards          │
│                                                              │
│  app/(marketing)/    — public marketing site                │
│  app/(auth)/         — login                                │
│  app/student/        — student panel (mobile-first)         │
│  app/employee/       — employee panel (desktop-first)       │
│  app/admin/          — admin panel (desktop-first)          │
│  app/api/            — 165 REST route handlers              │
├─────────────────────────────────────────────────────────────┤
│  lib/services/       — 29 service files (~8,800 LOC)        │
│  lib/auth/           — NextAuth v5 (Credentials, JWT)       │
│  lib/permissions/    — centralized RBAC                     │
│  lib/realtime/       — in-process SSE event bus             │
│  lib/security/       — in-memory rate limiter               │
│  lib/system/         — backups, health, audit, jobs         │
│  lib/validations/    — Zod schemas                          │
├─────────────────────────────────────────────────────────────┤
│  Prisma 6 (MongoDB provider)  →  MongoDB (Atlas or local)   │
│  30 models, ~70 indexes, soft-delete on 15 models           │
└─────────────────────────────────────────────────────────────┘
```

### Framework + runtime
- **Framework:** Next.js 16.3.4 (App Router, Turbopack)
- **Runtime:** Node.js (LTS — `runtime = "nodejs"` on SSE + cron routes)
- **React:** 19.2.8
- **TypeScript:** 5.x
- **Package manager:** npm (lockfile committed); `bun.lock` also present (legacy)

### Deployment target
- **Primary:** Vercel (serverless functions, `vercel.json` cron jobs)
- **Secondary:** Any Node.js host (`next start`)
- **Constraint:** Read-only filesystem on serverless → uploads stored as `Bytes` in MongoDB via `StoredFile` model (see `prisma/schema.prisma` lines 839–854)

---

## 2. Frontend Architecture

### Three role-based panels + marketing site

| Panel | Routes | Layout | Shell component | Primary accent |
|---|---|---|---|---|
| Marketing | `app/(marketing)/*` | `app/(marketing)/layout.tsx` | `components/marketing/navbar.tsx` + `footer.tsx` | `--primary` (brand) |
| Auth | `app/(auth)/*` | `app/(auth)/layout.tsx` | (minimal) | `--primary` |
| Student | `app/student/*` | `app/student/layout.tsx` | `components/student/app-shell.tsx` | Amber/gold |
| Employee | `app/employee/*` | `app/employee/layout.tsx` | `components/shared/admin-shell.tsx` | Dark slate |
| Admin | `app/admin/*` | `app/admin/layout.tsx` | `components/shared/admin-shell.tsx` | Dark slate |

### Component organization
```
components/
├── student/         — 19 subdirectories, mobile-first student panel
│   ├── app-shell.tsx        (mobile bottom-nav + desktop sidebar + Cmd+K search)
│   ├── ui.tsx               (STUDENT_TOKENS + 12 shared components)
│   ├── dashboard/           (today-agenda, premium-greeting-card, profile-completion-card)
│   ├── application/         (14 sub-components for the application detail tabs)
│   ├── documents/           (documents-view, document-card, upload-sheet, bulk-upload-sheet, document-preview)
│   ├── tasks/, payments/, invoices/, notifications/, messages/, appointments/
│   ├── universities/        (universities-compare-view, university-detail-view)
│   ├── courses/, visa/, profile/, settings/, support/, search/
│   └── realtime-provider.tsx (SSE client)
├── admin/           — 25+ admin-panel components (data-tables, filters, assign-panels)
├── shared/          — cross-panel primitives
│   ├── index.tsx             (StatCard, EmptyState, TableShell, Pagination, StatusBadge)
│   ├── admin-shell.tsx       (sidebar + header for employee/admin)
│   ├── data-table.tsx        (generic sortable/filterable table)
│   ├── page-kit.tsx          (form helpers)
│   └── nav-icons.tsx
├── marketing/       — 17 marketing-site components
├── ui/              — base primitives (Button, Card, Input, Badge, Select, Textarea, Label, Separator, Tooltip, toast, overlays)
├── analytics/       — AnalyticsProviders (GA4, GTM, Meta Pixel, consent banner)
├── pwa/             — PWA provider (install prompt, offline banner)
└── dashboard/       — shared dashboard widgets
```

### State management
- **Server state:** TanStack Query v5 (`@tanstack/react-query` ^5.102.8) — used in every student view file for fetching, caching, optimistic updates
- **Client state:** React `useState` / `useReducer` (no Redux / Zustand)
- **Forms:** React Hook Form ^7.87 + Zod ^4.5 resolvers
- **Real-time:** SSE via `EventSource` in `components/student/realtime-provider.tsx` → invalidates TanStack Query caches

### Styling
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **shadcn/ui-style** primitives in `components/ui/`
- **Design tokens:** `STUDENT_TOKENS` constant in `components/student/ui.tsx` (student panel); semantic CSS vars for employee/admin
- **Unified status colors:** Explicit Tailwind colors (emerald/amber/blue/red) across the entire app — see `APP_DESIGN_SYSTEM.md`
- **Icons:** Lucide React ^1.43 + FontAwesome ^7.3 (marketing site)
- **Fonts:** Inter (body) + Sora (display), via `next/font/google`

### Design system (recently shipped)
- `APP_DESIGN_SYSTEM.md` — top-level doc covering all 3 panels
- `STUDENT_DESIGN_SYSTEM.md` — detailed student panel reference
- `VISUAL_TESTING.md` — Playwright visual regression guide
- 3 live preview routes: `/student/design-preview`, `/employee/design-preview`, `/admin/design-preview`
- 15 Playwright visual regression tests (`tests/visual/`)

### Testing
- **Unit:** Vitest ^5.0 (50 test files in `tests/`, Node environment)
- **Visual:** Playwright ^1.63 (15 tests, Chromium-only, 10 baseline snapshots)
- **No E2E flow tests** (login → action → assert) — gap

---

## 3. Backend Architecture

### API surface
- **165 REST route handlers** in `app/api/`
- **Categorization:**
  - 54 student-scoped routes (`/api/student/*`) — always derive `studentId` from session, never from client input (closes IDOR)
  - 33 admin routes (`/api/admin/*`) — admin-only, granular permissions
  - 78 shared routes (`/api/applications`, `/api/students`, `/api/documents`, etc.) — role-aware via `guard()` + `requirePermission()`
- **API envelope:** `{ success: true, data }` or `{ success: false, error: { code, message, ...extra } }` — see `lib/api.ts`
- **Client helper:** `apiFetch<T>()` in `lib/api-client.ts` unwraps the envelope, throws on error

### Request lifecycle
```
HTTP request
  → proxy.ts (edge)              — auth cookie check, role → panel routing
  → app/api/*/route.ts           — handler
    → guard(permission)          — session + RBAC check (lib/auth/guards.ts)
    → zod schema parse           — input validation (lib/validations/)
    → lib/services/*.ts          — business logic
    → prisma.* query             — data access (lib/db.ts, soft-delete extension)
    → ok(data) | fail(...)       — envelope response
  → HTTP response
```

### Service layer (`lib/services/` — 29 files, ~8,800 LOC)

| Service | Lines | Responsibility |
|---|---|---|
| `student-dashboard.ts` | 604 | One optimized aggregate for the student dashboard (no N+1) |
| `student-document.ts` | — | Document CRUD + version history (replace flow) |
| `student-tasks.ts` | 490 | Task list/complete/start + tab views |
| `student-visa.ts` | 284 | Visa application tracking |
| `student-messages.ts` | — | Conversation + message sending |
| `student-appointments.ts` | — | Appointment request/confirm/cancel |
| `student-payments.ts` | — | Payment summary + history |
| `student-invoices.ts` | — | Invoice list + detail |
| `student-notifications.ts` | — | Notification list + read-marking |
| `student-profile.ts` | — | Profile fields + completion % |
| `student-settings.ts` | — | Notification prefs + theme + language |
| `student-support.ts` | — | Support tickets + FAQ |
| `student-application.ts` | — | Application detail aggregate |
| `application.ts` | — | Admin/employee application management |
| `student.ts` | 302 | Admin student CRUD |
| `lead.ts` | — | Lead pipeline |
| `document.ts` | — | Document review workflow |
| `visa.ts` | 189 | Visa requirement management |
| `finance.ts` | — | Invoice + payment management |
| `notification.ts` | — | Cross-user notification dispatch |
| `email.ts` | — | SMTP email (settings in DB) |
| `file-storage.ts` | — | StoredFile CRUD (MongoDB Bytes) |
| `audit.ts` | — | AuditLog write helper |
| `employee.ts` | — | Employee management |
| `reports-table.ts` | — | Report data aggregation |
| `data-export.ts` / `data-import.ts` | — | CSV/JSON export/import |
| `marketing-cms.ts` / `marketing-content.ts` | — | Marketing site content |
| `site-settings.ts` | — | SiteSetting key/value store |

### Real-time (`lib/realtime/event-bus.ts`)
- In-process `EventEmitter` — single-instance only
- SSE endpoint at `/api/student/events` (300s max duration, nodejs runtime)
- Client: `components/student/realtime-provider.tsx` invalidates TanStack Query caches on events
- **Multi-instance caveat documented in source:** must migrate to Redis pub/sub for serverless multi-replica

### Background jobs (`vercel.json` crons)
- `daily-backup` (02:00 UTC) → `/api/admin/system/backups/cron?job=daily-backup`
- `weekly-backup` (Mon 03:00 UTC)
- `monthly-backup` (1st 04:00 UTC)
- `cleanup-deleted-backups` (05:00 UTC daily)
- `health-check` (06:00 UTC daily)
- All cron routes validate `CRON_SECRET` query param

---

## 4. Database Architecture

### Engine
- **MongoDB** (Atlas or local) via Prisma 6.19.3 (`provider = "mongodb"`)
- Connection: `DATABASE_URL` env var
- Client: `lib/db.ts` — singleton with soft-delete Prisma extension

### Schema overview (`prisma/schema.prisma` — 1,020 lines, 30 models)

| Domain | Models |
|---|---|
| **Identity** | `Role`, `Permission`, `User`, `Branch` |
| **People** | `Student`, `Employee`, `Lead`, `AcademicRecord`, `EnglishProficiency` |
| **Education catalog** | `Country`, `University`, `Course`, `Intake` |
| **Application pipeline** | `ApplicationStage`, `Application`, `ApplicationStatusHistory` |
| **Documents** | `DocumentRequirement`, `Document` (with version history via self-relation) |
| **Visa** | `VisaRequirement`, `VisaApplication` |
| **Operations** | `Task`, `Appointment`, `Note`, `Conversation`, `Message`, `Notification` |
| **Student discovery** | `UniversityFavorite`, `CounselingRequest` |
| **Finance** | `Invoice` (items as Json), `Payment` |
| **System** | `AuditLog`, `SystemSetting`, `SiteSetting`, `StoredFile` (Bytes for serverless uploads) |
| **System admin** | `BackupRecord`, `BackupSchedule`, `SystemHealthCheck`, `SecurityEvent`, `MaintenanceWindow` |
| **Preferences** | `StudentPreference` |

### Key data models (per the audit request)

**Student** (lines 84–140)
- 30+ fields including passport, emergency contact, address (city/district/division/country/postalCode)
- Linked to `User` (1:1), `Branch` (N:1), `Employee` (N:1 — assigned counselor)
- Relations: academicRecords, englishProficiencies, applications, documents, payments, invoices, tasks, notes, conversations, appointments, supportRequests, preferences, universityFavorites, counselingRequests

**Course** (lines 273–301)
- Fields: degreeLevel (FOUNDATION|BACHELOR|MASTER|PHD|DIPLOMA), duration, tuitionFee, currency, applicationFee, applicationDeadline
- Structured English requirements: `ieltsRequirement`, `toeflRequirement`, `pteRequirement` (free-text strings like "6.5 overall, no band below 6.0")
- Relations: university, intakes, applications

**Result / Attendance / Assignment** — **NOT PRESENT**
- There is **no `Result`, `Attendance`, or `Assignment` model** in the schema. This is a study-abroad agency CRM, not a school LMS. The student journey here is: Lead → Counseling → Application → Documents → Visa → Enrollment. Academic performance is captured only as historical `AcademicRecord` (SSC/HSC/Diploma/Bachelor/Master/PhD) and `EnglishProficiency` (IELTS/TOEFL/PTE/Duolingo) — both are pre-admission credentials, not post-enrollment results.

**Notification** (lines 613–627)
- Fields: userId, type, title, message, link, readAt
- Indexed on `[userId]`, `[createdAt]`, composite `[userId, readAt]` for unread-count queries

**Payment** (lines 706–731)
- Fields: amount, currency (default BDT), paymentMethod (CASH|BANK_TRANSFER|BKASH|NAGAD|CARD|OTHER), transactionReference, status (PENDING|PAID|PARTIAL|REFUNDED|CANCELLED), paymentDate
- Relations: student, application, invoice

**Profile** — Student profile is the `Student` model itself (no separate `Profile` model). The student profile page (`app/student/profile/page.tsx`) edits `Student` fields + `AcademicRecord[]` + `EnglishProficiency[]`.

### Indexing strategy
- ~70 indexes (single-field + composite) declared in schema
- Composite indexes on common list-query patterns (e.g. `@@index([studentId, status])` on Document, Task, Invoice, Payment, Appointment, Notification, SupportRequest)
- AuditLog indexed on `[entityId]`, `[userId]`, `[action]`, `[createdAt]` for paginated admin views

### Soft-delete
- 15 models have `deletedAt` + `deletedBy` fields
- Prisma extension in `lib/db.ts` auto-sets `deletedAt: null` on create + auto-filters on read
- Models: Application, Branch, Country, Course, Document, Employee, Intake, Invoice, Lead, Payment, Student, Task, University, User, VisaApplication

### Migrations
- No `prisma/migrations/` directory — MongoDB is schemaless, so the team uses `prisma db push` (not `prisma migrate`)
- Seed: `prisma/seed.ts` (1,020 lines — generates demo admin/employee/student + full catalog)

---

## 5. Authentication Architecture

### Provider
- **NextAuth v5** (`next-auth` ^5.0.0-beta.32) — a.k.a. Auth.js
- **Strategy:** JWT (8-hour maxAge), no database sessions
- **Provider:** Credentials only (email + password, bcrypt-verified)
- **No OAuth** (Google/GitHub/etc.) — email/password only

### Session lifecycle (`lib/auth/index.ts`)
1. `authorize()` — validates email/password against `User.passwordHash` (bcrypt), checks `status === "ACTIVE"` and `deletedAt === null`
2. `jwt()` callback — on first sign-in, stores `role` + `branchId` + `lastChecked` timestamp in token
3. **Periodic re-validation** (every 5 minutes): re-fetches user from DB to detect suspension/deletion/role change → if invalid, sets `token.role = "INVALID"` (session effectively killed within 5 min)
4. `session()` callback — exposes `id`, `role`, `branchId` to client

### Authorization layers (defense in depth)

| Layer | File | Enforcement |
|---|---|---|
| **Edge proxy** | `proxy.ts` | Coarse role routing: STUDENT → `/student/*` only; ADMIN/EMPLOYEE → `/admin/*` + `/employee/*` |
| **Layout guard** | `app/student/layout.tsx` (and admin/employee equivalents) | Server-side redirect if role mismatch |
| **Page guard** | `lib/student/guard.ts` `requireStudentProfile()` | Server-component redirect if no student profile |
| **API guard** | `lib/auth/guards.ts` `guard(permission)` | 401 if no session, 403 if missing permission |
| **Service guard** | `studentApiGuard()` in `lib/student/guard.ts` | Derives `studentId` from session (never client input) — closes IDOR |

### RBAC (`lib/permissions/index.ts`)
- **3 roles:** ADMIN, EMPLOYEE, STUDENT
- **~80 permission keys** in a single `PERMISSIONS` constant (e.g. `"students.read": ["ADMIN", "EMPLOYEE"]`)
- `hasPermission(role, permission)` — single check function used everywhere
- `assertPermission()` — throws `PermissionError` for try/catch patterns
- `ROLE_HOME` map — role → post-login redirect

### Known auth gaps
- **No OAuth / SSO** — email/password only (acceptable for agency CRM, but blocks enterprise customers who require SSO)
- **No 2FA / MFA** — single-factor only
- **No session revocation API** — JWT can't be killed server-side; the 5-min re-validation is the mitigation (documented in `app/api/admin/system/sessions/route.ts`)
- **No password-reset email flow** — `User.resetTokenHash` + `resetTokenExpiry` fields exist in schema but no `/api/auth/reset-password` route was found in the audit

---

## 6. Existing API Endpoints

### Student panel (54 routes — `/api/student/*`)
All derive `studentId` from session via `studentApiGuard()`.

| Domain | Endpoints |
|---|---|
| **Dashboard** | `GET /api/student/dashboard` |
| **Application** | `GET /api/student/applications`, `GET /api/student/application/[id]`, `GET /api/student/application/[id]/timeline` |
| **Documents** | `GET /api/student/documents`, `GET /api/student/documents/[id]`, `GET /api/student/documents/[id]/download`, `POST /api/student/documents/[id]/replace` |
| **Tasks** | `GET /api/student/tasks`, `PATCH /api/student/tasks/[id]`, `POST /api/student/tasks/[id]/complete` |
| **Appointments** | `GET /api/student/appointments`, `GET /api/student/appointments/[id]`, `POST /api/student/appointments/request`, `POST /api/student/appointments/[id]/confirm`, `POST /api/student/appointments/[id]/cancel` |
| **Messages** | `GET /api/student/messages`, `GET /api/student/messages/[id]`, `GET /api/student/messages/[id]/messages`, `PATCH /api/student/messages/[id]/read` |
| **Notifications** | `GET /api/student/notifications`, `PATCH /api/student/notifications/[id]/read`, `POST /api/student/notifications/read-all` |
| **Payments** | `GET /api/student/payments`, `GET /api/student/payments/[id]`, `GET /api/student/payments/summary` |
| **Invoices** | `GET /api/student/invoices`, `GET /api/student/invoices/[id]` |
| **Profile** | `GET /api/student/profile`, `PATCH /api/student/profile`, `POST /api/student/profile/photo`, `GET/POST/PATCH/DELETE /api/student/profile/academic-records/[id]`, `GET/POST/PATCH/DELETE /api/student/profile/english-proficiencies/[id]` |
| **Settings** | `GET /api/student/settings`, `PATCH /api/student/settings`, `POST /api/student/settings/password` |
| **Visa** | `GET /api/student/visa`, `GET /api/student/visa/[id]`, `GET /api/student/visa/requirements` |
| **Universities** | `GET /api/student/universities`, `GET /api/student/universities/[id]`, `GET /api/student/universities/meta`, `POST /api/student/favorites` |
| **Courses** | `GET /api/student/courses`, `GET /api/student/courses/[id]`, `GET /api/student/courses/meta`, `GET /api/student/intakes` |
| **Counseling** | `POST /api/student/counseling-requests` |
| **Support** | `GET /api/student/support`, `GET /api/student/support/faq`, `GET /api/student/support/[id]` |
| **Search** | `GET /api/student/search` |
| **Real-time** | `GET /api/student/events` (SSE, 300s max) |

### Admin panel (33 routes — `/api/admin/*`)
Admin-only (`guard("system.read")` etc.). Includes:
- `/api/admin/system/backups` (CRUD + cron + restore + verify + download)
- `/api/admin/system/health` (+ cron)
- `/api/admin/system/security` (audit + RBAC matrix)
- `/api/admin/system/sessions` (active session list)
- `/api/admin/system/configuration` (env + DB settings health)
- `/api/admin/system/maintenance` (maintenance window)
- `/api/admin/system/logs` (+ `[id]/resolve`)
- `/api/admin/system/jobs` (+ cron)
- `/api/admin/system/analytics`, `/api/admin/system/tracking/test`
- `/api/admin/system/seo`

### Shared routes (78 routes — role-aware)
Examples: `/api/applications`, `/api/students`, `/api/employees`, `/api/leads`, `/api/documents`, `/api/invoices`, `/api/payments`, `/api/visa`, `/api/conversations`, `/api/notifications`, `/api/countries`, `/api/universities`, `/api/courses`, `/api/intakes`, `/api/branches`, `/api/roles`, `/api/permissions`, `/api/users`, `/api/audit-logs`, `/api/reports`, `/api/stages`, `/api/document-requirements`, `/api/files`, `/api/brand`, `/api/settings`, `/api/contact`, `/api/maintenance/status`, `/api/marketing/cms`

### Auth routes
- `app/api/auth/[...nextauth]/route.ts` — NextAuth handlers (login, logout, session)
- No reset-password or verify-email endpoints found

---

## 7. Student Data Flow

### Read flow (dashboard example)
```
1. Student visits /student
2. app/student/layout.tsx → requireStudentProfile()
   → auth() → check role === "STUDENT" → load Student from DB
3. app/student/page.tsx (server component) → getStudentDashboard(student, userId)
   → lib/services/student-dashboard.ts
   → parallel prisma queries (applications, documents, tasks, payments, appointments,
     notifications, counselor, activities) — all scoped by student.id
   → returns one optimized aggregate (no N+1)
4. Page renders server-side with the aggregate
5. Client hydrates → StudentRealtimeProvider opens SSE to /api/student/events
   → on event, invalidates TanStack Query cache → refetch
```

### Write flow (document upload example)
```
1. Student opens UploadSheet (client component)
2. POST /api/student/documents with FormData
   → studentApiGuard() → derives studentId from session
   → zod validate input
   → lib/services/student-document.ts → createDocument()
   → prisma.document.create({ data: { studentId, ... } })
   → file bytes → StoredFile.create (MongoDB Bytes)
   → emit event to studentEventBus → SSE pushes to client
   → notification created for assigned counselor
3. Client receives SSE event → invalidates ["student-documents"] query → refetch
4. Counselor sees new document in their /employee/documents queue (via their own SSE or polling)
```

### Real-time event flow
```
Service (e.g. student-messages.ts)
  → studentEventBus.publish({ type: "message_received", studentId, payload })
  → /api/student/events SSE endpoint (subscribed for that studentId)
  → controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
  → StudentRealtimeProvider (client)
  → queryClient.invalidateQueries(["student-messages"])
  → TanStack refetch → UI updates in milliseconds
```

**Caveat:** In-process event bus → only works for single-instance deployments. For multi-replica (Vercel serverless with >1 instance), must migrate to Redis pub/sub (documented in `lib/realtime/event-bus.ts`).

---

## 8. Existing Reusable Components

### Student panel (`components/student/ui.tsx`)
- `MobilePage`, `MobileCard` — layout
- `StudentSection`, `PageHeader` — sections + headers
- `StudentStatCard` — KPI tile with tone variants
- `StudentEmptyState`, `StudentErrorState` — state components
- `StatusBadge`, `FilterChip` — badges + chips
- `ProgressCard`, `QuickAction`, `Timeline` — specialized
- `NotificationBadge`, `LoadingCards` — feedback
- `STUDENT_TOKENS` — design token constant

### Shared (`components/shared/index.tsx`)
- `StatCard` — KPI card with title/value/hint/icon
- `EmptyState` — dashed-border empty state
- `TableShell` — table wrapper with header row
- `Pagination` — prev/next with query preservation
- `StatusBadge` — auto-tone from status string (~40 statuses mapped in `STATUS_TONES`)

### Base UI (`components/ui/index.tsx`)
- `Button` (variants: default, outline, ghost, destructive; sizes: sm, default, lg)
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Input`, `Select`, `Textarea`, `Label`, `Separator`, `Tooltip`
- `Badge` (tone-based, used in marketing/admin/employee — student panel migrated to `StatusBadge`)
- Overlays: `Dialog`, `Sheet`, `Tabs` (in `components/ui/overlays.tsx`)
- Toast: `components/ui/toast.tsx`

### Cross-cutting
- `components/shared/providers.tsx` — React Query provider + theme
- `components/student/realtime-provider.tsx` — SSE client + live indicator
- `components/shared/admin-shell.tsx` — employee/admin sidebar + header
- `components/student/app-shell.tsx` — student mobile shell
- `components/pwa/` — PWA install + offline banner
- `components/analytics/providers.tsx` — GA4/GTM/Meta Pixel + consent banner

---

## 9. Recommended AI Integration Point

### Where an AI Student Assistant fits safely

The safest, highest-leverage integration point is a **new `/api/student/assistant` route** that sits behind the existing `studentApiGuard()` and calls a read-only "tool layer" — never the database directly.

```
┌────────────────────────────────────────────────────────────┐
│  Student Client (browser)                                  │
│  └─ <StudentAssistant /> component (new)                   │
│      └─ POST /api/student/assistant/chat (streaming SSE)   │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│  /api/student/assistant/chat  (NEW)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. studentApiGuard()  →  derive studentId from sess │  │
│  │ 2. rate-limit (per-student)                         │  │
│  │ 3. zod validate { message, conversationId? }       │  │
│  │ 4. load conversation history (new AiConversation)   │  │
│  │ 5. build system prompt with student context         │  │
│  │ 6. call LLM (OpenAI/Anthropic) with tool defs       │  │
│  │ 7. stream tokens back via SSE                       │  │
│  │ 8. if LLM calls a tool → execute → return result    │  │
│  │ 9. persist user msg + assistant msg to AiMessage    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│  Tool Layer (NEW — lib/ai/tools/)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ getApplicationStatus(studentId)                     │  │
│  │ getDocumentsStatus(studentId)                       │  │
│  │ getUpcomingAppointments(studentId)                  │  │
│  │ getTasksDue(studentId)                              │  │
│  │ getPaymentSummary(studentId)                        │  │
│  │ getUniversityInfo(universityId)                     │  │
│  │ searchCourses(query)                                │  │
│  │ getVisaRequirements(countryId)                      │  │
│  │ ────────────────────────────────────────            │  │
│  │ ⚠️  NO write tools in Phase 1.                      │  │
│  │ ⚠️  All tools inherit studentId from guard —        │  │
│  │     never accept it as a parameter.                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│  LLM Provider (NEW — lib/ai/provider.ts)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ OpenAI / Anthropic / Azure OpenAI                   │  │
│  │ ─ API key in env: AI_PROVIDER_API_KEY              │  │
│  │ ─ Model: gpt-4o-mini / claude-haiku-4 (cost)       │  │
│  │ ─ Streaming via provider SDK                       │  │
│  │ ─ Token budget per request (e.g. 4K input, 1K out) │  │
│  │ ─ Safety: refuse to discuss other students         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Why this is safe
1. **Auth inherited** — `studentApiGuard()` derives `studentId` from session; the AI never sees another student's data
2. **Read-only in Phase 1** — tools only fetch data; the AI cannot mutate state
3. **Per-student rate limit** — reuses `lib/security/rate-limit.ts` (e.g. 20 msgs/hour)
4. **Tool layer is the only data path** — LLM never gets raw DB access
5. **Context injection** — system prompt includes student's name, stage, country, but NOT PII like passport number
6. **Streaming** — SSE reuses the existing `/api/student/events` pattern

### Hermes API feasibility
**Hermes is not integrated and not needed.** The "Hermes" in the lockfile is `hermes-parser` (a JS parser for ESLint). If by "Hermes API" you meant a specific external AI agent framework, it is not present and would need to be added as a new dependency. The recommended architecture above uses a standard LLM provider (OpenAI/Anthropic) with a custom tool layer — this is simpler, more auditable, and avoids vendor lock-in.

---

## 10. Security Risks

### High severity

| # | Risk | Evidence | Mitigation |
|---|---|---|---|
| H1 | **In-process event bus breaks in multi-instance** | `lib/realtime/event-bus.ts` (in-memory `EventEmitter`) | Migrate to Redis pub/sub before scaling beyond 1 instance |
| H2 | **In-memory rate limiter breaks in multi-instance** | `lib/security/rate-limit.ts` (in-memory `Map`) | Migrate to Redis-backed limiter |
| H3 | **No server-side session revocation** | JWT strategy, 8-hour maxAge, 5-min re-validation is the only kill switch | Acceptable for current scale; add a `revokedTokens` collection if immediate revocation is required |
| H4 | **No password-reset email flow** | `User.resetTokenHash` field exists but no route implements it | Add `/api/auth/forgot-password` + `/api/auth/reset-password` routes |
| H5 | **No 2FA / MFA** | Single-factor auth only | Add TOTP-based 2FA for ADMIN + EMPLOYEE roles |

### Medium severity

| # | Risk | Evidence | Mitigation |
|---|---|---|---|
| M1 | **AI integration would expand attack surface** | (Future risk) | Read-only tools in Phase 1; per-student rate limit; context sanitization; prompt injection tests |
| M2 | **LLM cost / abuse risk** | (Future risk) | Per-student daily message cap; token budget per request; alert on anomalous usage |
| M3 | **No CSRF protection on mutations** | NextAuth v5 + same-origin cookies | Next.js App Router has built-in CSRF for server actions; API routes rely on same-origin cookie. Acceptable but should add `Origin` header check on state-changing routes |
| M4 | **CSP allows `unsafe-inline` scripts** | `next.config.ts` SECURITY_HEADERS | Replace with nonce-based CSP (documented as future work in source) |
| M5 | **Files stored as MongoDB `Bytes`** | `StoredFile` model | Scalable to ~16MB per file; for larger files, migrate to S3/R2/Vercel Blob (the schema already has `storageProvider` field on `BackupRecord`) |

### Low severity
- No PII redaction in AuditLog (passport numbers could appear in `oldValue`/`newValue` Json fields)
- No request body size limit on upload routes (mitigated by MongoDB 16MB document limit)
- `postinstall` runs `prisma generate` — fails silently in CI without schema access (acceptable)

### Existing security strengths
- **IDOR closed** on all student routes — `studentApiGuard()` derives `studentId` from session
- **RBAC centralized** — single `PERMISSIONS` map, single `hasPermission()` function
- **Soft-delete on 15 models** — data is recoverable
- **AuditLog on sensitive ops** — stage changes, document reviews, payment ops
- **Security headers** — HSTS, X-Frame-Options DENY, CSP (with `unsafe-inline` caveat)
- **`unsafe-eval` removed** from CSP (H6 fix documented in source)
- **Periodic JWT re-validation** (5-min) catches suspended/deleted users
- **Bcrypt password hashing** (bcryptjs)
- **Zod validation on every API input**
- **Vercel cron secret** on all cron routes

---

## 11. Missing Infrastructure

### For AI integration (Phase 1+)
- ❌ **No LLM SDK** — need `openai` or `@anthropic-ai/sdk` dependency
- ❌ **No AI env vars** — need `AI_PROVIDER_API_KEY`, `AI_PROVIDER_MODEL`, `AI_PROVIDER_BASE_URL?`
- ❌ **No AI data models** — need `AiConversation`, `AiMessage` Prisma models (for history)
- ❌ **No AI rate limiter** — need per-student message cap (reuse `lib/security/rate-limit.ts`)
- ❌ **No prompt templates** — need `lib/ai/prompts/` directory
- ❌ **No tool registry** — need `lib/ai/tools/` directory + tool-call dispatcher
- ❌ **No AI cost tracking** — need to log token usage per request for billing/monitoring

### For production hardening (existing gaps)
- ❌ **No Redis** — required for multi-instance SSE + rate limiting
- ❌ **No external file storage** — `StoredFile` uses MongoDB `Bytes` (16MB limit)
- ❌ **No password reset flow** — schema fields exist, routes don't
- ❌ **No 2FA** — single-factor only
- ❌ **No E2E tests** — only unit (Vitest) + visual (Playwright)
- ❌ **No OAuth/SSO** — email/password only
- ❌ **No webhook system** — no outbound event delivery to integrations

### Already present (good foundation)
- ✅ RBAC + permission system
- ✅ AuditLog + SecurityEvent models
- ✅ SSE infrastructure (reusable for AI streaming)
- ✅ TanStack Query (reusable for AI chat state)
- ✅ Zod validation
- ✅ Soft-delete + indexing
- ✅ Vercel cron jobs
- ✅ Backup + restore system
- ✅ Design system + visual regression tests

---

## 12. Recommended Implementation Phases

### Phase 0 — Foundation (1 week, no AI yet)
**Goal:** Add infrastructure that AI integration will need, without shipping any AI features.

1. **Add Prisma models** for AI conversation persistence:
   - `AiConversation` (studentId, title, createdAt, updatedAt)
   - `AiMessage` (conversationId, role: "user"|"assistant"|"tool", content, toolCalls Json?, tokenCount Int?, createdAt)
2. **Add env vars** to `.env.example`:
   - `AI_PROVIDER` (openai | anthropic | azure)
   - `AI_PROVIDER_API_KEY`
   - `AI_PROVIDER_MODEL` (e.g. `gpt-4o-mini`)
   - `AI_DAILY_MESSAGE_LIMIT` (default 50)
3. **Add rate limiter** for AI: per-student daily cap + per-minute burst (reuse `lib/security/rate-limit.ts` pattern)
4. **Run `prisma db push`** to sync new models

**Acceptance criteria:** New models exist in DB, env vars documented, no UI changes.

### Phase 1 — Read-only Student Assistant (2 weeks)
**Goal:** Ship a student-facing chat assistant that can answer questions about their own data.

1. **Create `lib/ai/` directory:**
   ```
   lib/ai/
   ├── provider.ts          — LLM client (OpenAI/Anthropic), streaming
   ├── prompts/
   │   └── student-assistant.ts — system prompt with safety rules
   ├── tools/
   │   ├── registry.ts      — tool definitions + dispatcher
   │   ├── application.ts   — getApplicationStatus(studentId)
   │   ├── documents.ts     — getDocumentsStatus(studentId)
   │   ├── tasks.ts         — getTasksDue(studentId)
   │   ├── appointments.ts  — getUpcomingAppointments(studentId)
   │   ├── payments.ts      — getPaymentSummary(studentId)
   │   ├── universities.ts  — getUniversityInfo(id), searchCourses(query)
   │   └── visa.ts          — getVisaRequirements(countryId)
   └── context.ts           — build student context (name, stage, country — NO PII)
   ```

2. **Create API route:** `app/api/student/assistant/chat/route.ts`
   - `studentApiGuard()` → derive studentId
   - Rate-limit check (per-student)
   - Load or create `AiConversation`
   - Build system prompt + student context
   - Call LLM with tool definitions
   - Stream response via SSE (reuse `/api/student/events` pattern)
   - Persist `AiMessage` rows (user + assistant)
   - **Read-only:** no write tools, no mutations

3. **Create UI component:** `components/student/assistant/assistant-chat.tsx`
   - Floating button bottom-right (mobile + desktop)
   - Slide-up panel with message history + input
   - Streaming responses (SSE)
   - Quick-suggestion chips ("What's my application status?", "When is my next appointment?")
   - Uses TanStack Query for conversation history
   - Respects design system (amber accent, `MobileCard`, `StatusBadge`)

4. **Add to student nav:** "AI Assistant" link in `STUDENT_MORE` (config/student-nav.ts)

5. **Tests:**
   - Vitest unit tests for tool layer (mock prisma)
   - Vitest test for rate limiter
   - Playwright visual test for the chat panel (closed + open states)

**Acceptance criteria:** Student can ask "What documents do I still need to upload?" and get an accurate answer based on their data. No mutations possible.

### Phase 2 — Knowledge Base + FAQs (1 week)
**Goal:** Let the AI answer general questions (not just student-specific).

1. **Add `AiKnowledgeBase` model** (category, question, answer, embedding Json?)
2. **Seed with FAQs** from `app/api/student/support/faq/route.ts`
3. **Add tool:** `searchKnowledgeBase(query)` — semantic search (or keyword search in Phase 2, embeddings in Phase 3)
4. **Admin UI:** `/admin/ai/knowledge-base` — CRUD for knowledge entries
5. **Counselor handoff tool:** `createSupportTicket(subject, description)` — if AI can't answer, create a `SupportRequest` (first write tool — requires explicit confirmation in UI)

**Acceptance criteria:** Student can ask "What is IELTS?" and get a knowledge-base answer. AI can offer to create a support ticket when stuck.

### Phase 3 — Embeddings + Semantic Search (1 week)
**Goal:** Improve knowledge-base search with vector embeddings.

1. **Add embedding generation** on knowledge-base CRUD (OpenAI `text-embedding-3-small`)
2. **Store embeddings** in `AiKnowledgeBase.embedding` (Json array)
3. **Cosine similarity search** in `searchKnowledgeBase(query)` — generate query embedding, compare in-memory (or use MongoDB Atlas Vector Search if available)
4. **Hybrid search:** keyword + semantic, merge results

**Acceptance criteria:** "How much does it cost to study in Germany?" returns the Germany tuition-fee knowledge entry even if the exact words differ.

### Phase 4 — Employee Assistant (2 weeks)
**Goal:** Give employees an AI assistant for their workload (student summaries, draft messages, task prioritization).

1. **New route:** `/api/employee/assistant/chat` — uses `guard("tasks.read")` instead of `studentApiGuard()`
2. **Employee tools:**
   - `getStudentSummary(studentId)` — 360° view (scoped to assigned students)
   - `getOverdueTasks()` — across assigned students
   - `draftMessageToStudent(studentId, topic)` — returns a draft (employee reviews + sends)
   - `getPipelineStatus()` — applications by stage
3. **UI:** `components/employee/assistant/assistant-chat.tsx` — sidebar panel in employee shell
4. **Phase 4 write tools** (with confirmation UI):
   - `createTask(studentId, title, dueDate)` — drafts a task for employee review
   - `scheduleAppointment(studentId, ...)` — drafts an appointment request

**Acceptance criteria:** Employee can ask "Show me all overdue tasks for my students" and get a structured answer. Draft messages require explicit "Send" click.

### Phase 5 — Admin Analytics Assistant (1 week)
**Goal:** Admin can ask natural-language questions about system metrics.

1. **New route:** `/api/admin/assistant/chat` — `guard("dashboard.read")`
2. **Admin tools:**
   - `getSystemHealth()` — reuses `lib/system/health.ts`
   - `getActiveUsers(window)` — from `app/api/admin/system/sessions/route.ts` logic
   - `getRevenueSummary(range)` — from `lib/services/reports-table.ts`
   - `getApplicationPipeline()` — applications by stage
3. **UI:** `components/admin/assistant/` — admin sidebar panel

**Acceptance criteria:** Admin can ask "How many students applied this month?" and get a chart + number.

### Phase 6 — Multi-instance + Hardening (1 week)
**Goal:** Production-ready for scale.

1. **Migrate SSE event bus** to Redis pub/sub (`lib/realtime/event-bus.ts`)
2. **Migrate rate limiter** to Redis (`lib/security/rate-limit.ts`)
3. **Add AI cost dashboard** to `/admin/system` (token usage, cost per day, per student)
4. **Add prompt-injection tests** to Vitest (red-team prompts that try to extract other students' data)
5. **Add AI audit log** — every assistant message logged to `AuditLog` with `action: "ai.assistant_message"`
6. **Add AI kill switch** — `SystemSetting` key `ai_assistant_enabled` (admin can disable globally)

**Acceptance criteria:** App runs on 2+ Vercel instances with no SSE duplication; admin can disable AI instantly.

---

## Recommended Architecture (Summary)

```
┌─────────────────────────────────────────────────────────────┐
│                    Existing SVMS (untouched)                 │
│  Next.js 16 + MongoDB + Prisma + NextAuth + RBAC + SSE      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │  (new routes, new components,
                            │   new lib/ai/ — no existing files modified)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Assistant Layer (NEW)                  │
│                                                              │
│  app/api/student/assistant/chat/route.ts   (SSE stream)     │
│  app/api/employee/assistant/chat/route.ts  (Phase 4)        │
│  app/api/admin/assistant/chat/route.ts     (Phase 5)        │
│                                                              │
│  lib/ai/provider.ts          — OpenAI/Anthropic client      │
│  lib/ai/prompts/             — system prompts per role      │
│  lib/ai/tools/registry.ts    — tool dispatcher              │
│  lib/ai/tools/*.ts           — read-only tools (Phase 1)    │
│  lib/ai/context.ts           — student-safe context builder │
│  lib/ai/rate-limit.ts        — per-student daily cap         │
│                                                              │
│  components/student/assistant/  — floating chat panel       │
│  components/employee/assistant/ — sidebar panel (Phase 4)   │
│  components/admin/assistant/    — sidebar panel (Phase 5)   │
│                                                              │
│  Prisma: AiConversation, AiMessage (Phase 0)                │
│  Prisma: AiKnowledgeBase (Phase 2)                          │
│                                                              │
│  Env: AI_PROVIDER, AI_PROVIDER_API_KEY, AI_PROVIDER_MODEL   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              LLM Provider (external, NEW)                    │
│  OpenAI / Anthropic / Azure OpenAI                          │
│  ─ Streaming responses via SDK                              │
│  ─ Tool calling for structured data fetches                 │
│  ─ Token budget per request (4K in, 1K out)                 │
│  ─ Cost: ~$0.001–$0.01 per conversation (gpt-4o-mini)       │
└─────────────────────────────────────────────────────────────┘
```

### Design principles
1. **Non-invasive** — no existing files are modified; all AI code lives in new directories (`lib/ai/`, `components/*/assistant/`, `app/api/*/assistant/`)
2. **Auth-inherited** — every AI route uses the existing `studentApiGuard()` / `guard()` pattern; the AI never authenticates itself
3. **Read-only first** — Phase 1 ships zero write tools; the AI cannot mutate state
4. **Tool-gated** — the LLM never gets raw DB access; it can only call whitelisted tools that inherit the student's identity
5. **Context-sanitized** — the system prompt includes student name + stage + country, but never passport numbers, password hashes, or other students' data
6. **Rate-limited** — per-student daily cap + per-minute burst, reusing the existing `lib/security/rate-limit.ts` pattern
7. **Auditable** — every conversation persisted to `AiConversation` + `AiMessage`; every message logged to `AuditLog`
8. **Kill-switchable** — `SystemSetting` key `ai_assistant_enabled` lets admin disable globally without a deploy
9. **Cost-bounded** — token budget per request + per-student daily message cap + cost dashboard in admin
10. **Incremental** — 6 phases, each shippable independently, each behind a feature flag

### Why not Hermes
There is no Hermes API in this project, no Hermes dependency, and no Hermes configuration. The "Hermes" in `bun.lock` is `hermes-parser` (an ESLint dependency). Building the AI assistant on a real LLM provider (OpenAI/Anthropic) with a custom tool layer is simpler, more auditable, and avoids introducing an unfamiliar framework. If a specific Hermes-branded API exists externally that you want to use, it can be plugged into `lib/ai/provider.ts` as a swappable backend — but the architecture above does not depend on it.

---

## Appendix: Audit Methodology

This report is based on a read-only audit of the following:
- `package.json` (dependencies + scripts)
- `prisma/schema.prisma` (1,020 lines, 30 models)
- `lib/auth/index.ts` (NextAuth config)
- `lib/auth/guards.ts` (API guard pattern)
- `lib/permissions/index.ts` (RBAC matrix)
- `lib/student/guard.ts` (student IDOR closure)
- `lib/realtime/event-bus.ts` (SSE infrastructure)
- `lib/security/rate-limit.ts` (rate limiter)
- `lib/db.ts` (Prisma + soft-delete extension)
- `lib/system/env.ts` (env + DB settings health)
- `lib/system/jobs.ts` (cron jobs)
- `lib/services/*.ts` (29 service files, ~8,800 LOC — sampled)
- `app/api/*/route.ts` (165 route handlers — enumerated)
- `app/student/layout.tsx`, `app/employee/layout.tsx`, `app/admin/layout.tsx`
- `app/api/student/dashboard/route.ts` + `app/api/student/events/route.ts` (sample routes)
- `app/api/applications/route.ts` (sample shared route)
- `proxy.ts` (edge middleware)
- `next.config.ts` (security headers)
- `vercel.json` (cron config)
- `.env.example` (env vars)
- `components/student/ui.tsx`, `components/shared/index.tsx`, `components/ui/index.tsx`
- `config/navigation.ts`, `config/student-nav.ts`
- `APP_DESIGN_SYSTEM.md`, `STUDENT_DESIGN_SYSTEM.md`, `VISUAL_TESTING.md`
- `bun.lock` / `package-lock.json` (searched for OpenAI/Anthropic/Hermes/LLM — none found in source code)

No files were modified during this audit.
