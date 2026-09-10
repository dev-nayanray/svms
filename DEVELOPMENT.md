# SVMS Development Guide

## 1. Project Overview

SVMS is a Student Visa Management System for education consultancies. It manages the full
lifecycle: **Lead → Counseling → Student Registration → Assessment → Country/University/Course
Selection → Document Collection → University Application → Offer → Deposit → Visa → Decision →
Travel → Completed**, with audit trail, RBAC, finance, and notifications.

## 2. Technology Stack

| Technology        | Why                                                                       |
| ----------------- | ------------------------------------------------------------------------- |
| Next.js 16 (App Router) | Server components for fast, DB-adjacent pages; route handlers for APIs |
| TypeScript (strict) | Type safety across the stack                                             |
| MongoDB + Prisma  | Document store with relational-style schema via ObjectId references      |
| Auth.js (NextAuth v5) | Credentials auth, JWT sessions, edge-safe middleware                    |
| Tailwind CSS v4   | Semantic design tokens, dark mode via `.dark` class                      |
| React Hook Form + Zod | One schema shape shared client/server validation                       |
| TanStack Query    | Client-side fetching where used                                           |
| Recharts          | Dashboard charts                                                          |
| bcryptjs          | Password hashing                                                          |

## 3. Requirements

- Node.js 20+
- npm
- MongoDB 6+ (local or Atlas)
- Environment variables (see below)

## 4. Installation

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL + AUTH_SECRET
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

## 5. Environment Variables

| Variable                  | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`            | MongoDB connection string                            |
| `AUTH_SECRET`             | Auth.js session signing secret (openssl rand -base64 32) |
| `NEXT_PUBLIC_APP_URL`     | Public app URL                                       |
| `NEXT_PUBLIC_APP_NAME`    | Display name                                         |
| `STORAGE_*`               | Object storage for private documents (TODO)          |
| `EMAIL_SERVER` / `EMAIL_FROM` | Transactional email (TODO)                       |
| `SEED_*_PASSWORD`         | Demo seed passwords (dev only)                       |

Never commit `.env`.

## 6. Database Setup

MongoDB with Prisma. MongoDB is document-based, so there are no migrations — use
`prisma db push` to sync the schema. Collections are created on demand with the indexes
declared in `prisma/schema.prisma`.

## 7. Prisma Commands

```bash
npx prisma generate   # regenerate the typed client after schema changes
npx prisma db push    # sync schema + indexes to the database
npx prisma studio     # browse data at http://localhost:5555
```

## 8. Seed Data

```bash
npm run seed           # idempotent (upserts)
```

Seeds: roles, demo branch, demo admin/employee/student (passwords from env), the 18 pipeline
stages, 4 countries, 3 universities, 4 courses, UK visa requirements, document requirements,
and a demo application with history, a task, and a notification.

## 9. Authentication

- Auth.js v5, Credentials provider, **JWT strategy** (stateless, edge-friendly).
- `lib/auth/index.ts` — provider config, `authorize` (bcrypt compare, status checks),
  `jwt`/`session` callbacks that carry `role` and `branchId` on the session.
- `middleware.ts` — edge middleware checks the session cookie for `/admin`, `/employee`,
  `/student`, `/dashboard` and redirects to `/login?callbackUrl=…`.
- Role enforcement (403) happens in **server layouts and API guards**, not the edge.
- Registration (`POST /api/auth/register`) creates a User (STUDENT role) + Student profile.
- Forgot/reset password UI exists; email delivery is TODO (see §28).

## 10. RBAC

`lib/permissions/index.ts` holds the single source of truth:

```ts
hasPermission(user.role, "students.read");
assertPermission(role, "applications.manage"); // throws PermissionError → 403
```

API guards: `guard(permission)` (returns 401/403 responses) and `requirePermission`
(throws, for use with `handleApiError`). Pages: `RoleLayout` redirects disallowed roles to
`/403`. Never scatter role-string checks in components.

## 11. Folder Architecture

```text
app/
  (auth)/        login, register, forgot-password
  admin/         admin panel (dashboard, students, leads, applications, catalog,
                 documents, tasks, finance, reports, audit, settings)
  employee/      counselor workspace (scoped to assigned cases)
  student/       student portal (own data only)
  api/           REST route handlers
components/
  ui/            primitives (Button, Card, Badge, Input…)
  shared/        SidebarShell, RoleLayout, StatCard, TableShell, Pagination, StatusBadge
  modules/       reusable page-level components (lists, detail views, forms)
  charts/        Recharts wrappers
config/navigation.ts  per-role navigation
lib/
  auth/          NextAuth config, guards, session helpers
  db.ts          Prisma singleton
  permissions/   RBAC
  services/      business logic (student, application, document, finance, audit, notification)
  validations/   Zod schemas
  api.ts         response envelope + error handling
prisma/          schema.prisma, seed.ts
```

## 12. Database Architecture

Models and relations (all ids are MongoDB ObjectIds):

- **Identity**: `User` (email unique, passwordHash, roleName, branchId) → `Role`, `Branch`;
  `User` 1–1 `Student` / `Employee`.
- **CRM**: `Lead` (status NEW→CONVERTED, `convertedStudentId`).
- **Student**: profile + passport + emergency contact; `AcademicRecord[]` (SSC…PHD),
  `EnglishProficiency[]` (IELTS/TOEFL/PTE/Duolingo); `assignedEmployeeId`.
- **Catalog**: `Country` → `University` → `Course` → `Intake`; `VisaRequirement` per country.
- **Pipeline**: `Application` (unique `SV-YYYY-NNNNNN` number, stageKey, priority) →
  `ApplicationStatusHistory[]`, `ApplicationStage` (admin-editable 18-stage pipeline),
  `VisaApplication`.
- **Documents**: `DocumentRequirement`, `Document` (status flow, reviewer, expiry).
- **Operations**: `Task`, `Note` (INTERNAL vs STUDENT visibility), `Conversation`/`Message`,
  `Notification`.
- **Finance**: `Invoice` (server-computed totals, items JSON) → `Payment`.
- **System**: `AuditLog`, `SystemSetting`, `Branch`.

Indexes cover the hot lookups: `User.email` (unique), `Student.studentId/userId` (unique),
`Application.applicationNumber` (unique) + student/employee/stage/country, `Document.studentId/
applicationId/status`, `Task.assignedToId/dueDate`, `Notification.userId`, `AuditLog.entityId`,
etc. Review against real query patterns as data grows.

## 13. API Architecture

All routes under `/api` return the same envelope:

```json
{ "success": true,  "data": {…}, "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "…" } } }
```

Status codes: 200/201 success, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict,
422 (validation surfaces as 422 with `fields`), 500 internal (no stack traces in production).
Server-side pagination everywhere (`?page=&pageSize=&search=&status=`).

Endpoints: `auth/[...nextauth]`, `auth/register`, `students`, `students/[id]`, `leads`,
`leads/[id]`, `leads/[id]/convert`, `applications`, `applications/[id]`, `applications/[id]/status`,
`applications/[id]/timeline`, `documents`, `documents/[id]/review`, `universities(+/[id])`,
`courses(+/[id])`, `countries`, `visa/requirements`, `tasks(+/[id])`, `payments`, `invoices(+/[id])`,
`notifications`, `reports`.

## 14. Application Workflow

```
Lead (NEW→QUALIFIED) ──convert──▶ Student ──create──▶ Application (stage LEAD)
  → COUNSELING → … → DOCUMENT_COLLECTION → APPLICATION_SUBMITTED → OFFERS → DEPOSIT
  → VISA_PREPARATION → VISA_SUBMITTED → BIOMETRICS → INTERVIEW → VISA_DECISION
  → TRAVEL_PREPARATION → COMPLETED
```

Stage changes go through `applicationService.changeStage`, which (transactionally) writes the
new stage + an `ApplicationStatusHistory` entry, notifies the student, and audit-logs old→new.
The pipeline is data (`ApplicationStage`), not hardcoded in UI.

## 15. Document Workflow

`REQUESTED → UPLOADED → UNDER_REVIEW → APPROVED | REJECTED → (re-upload on rejection)`,
plus `EXPIRED`. Uploads validate MIME type and size **server-side**. Reviews record reviewer,
timestamp, and a student-visible note; approvals/rejections notify the student. Approved
documents cannot be silently replaced or rejected without explicit revocation.

## 16. Payment Workflow

Invoice (DRAFT → ISSUED → PARTIAL → PAID | OVERDUE | CANCELLED) with items; **subtotal,
discount, total, due are always computed server-side**. Payments (CASH/BANK_TRANSFER/BKASH/
NAGAD/CARD/OTHER) are recorded against a student/invoice; recording a payment updates the
invoice's paid/due/status and refuses overpayment beyond the due amount.

## 17. Notification System

`notifications.push({ userId, type, title, message, link })` from services. Events: document
uploaded/approved/rejected, application stage changed, task assigned, payment recorded, new
message. `GET /api/notifications` returns latest 50 + unread count; `PATCH` marks read.

## 18. Audit Logging

`auditLog.record({ userId, action, entity, entityId, oldValue, newValue, ipAddress, userAgent })`.
Logged actions include: user.registered, student.created/soft_deleted, lead.converted,
application.created/stage_changed, document.uploaded/approved/rejected/under_review,
invoice.created, payment.recorded, university.created, country.created, task.created.
Viewable at `/admin/audit`.

## 19. UI/UX Standards

Semantic Tailwind tokens (`background/foreground/card/muted/border/primary/…`), no hardcoded
palette. Cards + tables + badges; skeleton-free server rendering with `force-dynamic`; empty
states on every list; destructive/red, success/green, warning/amber semantics. Responsive:
sidebar on desktop, compact icon nav on mobile. Dark mode: light/dark/system via `.dark` class
persisted in localStorage.

## 20. Coding Standards

- TypeScript strict; avoid `any`.
- Business logic lives in `lib/services` — never in components or route handlers.
- One table/form pattern (`TableShell`, RHF+Zod forms) — no per-page reimplementations.
- Server components by default; `"use client"` only for interactivity.
- Naming: camelCase functions/vars, PascalCase components/types, UPPER_SNAKE enum-like strings.
- Zod schemas in `lib/validations` shared by client forms and server handlers.

## 21. Security

See [SECURITY.md](./SECURITY.md). Highlights: bcrypt hashing, centralized RBAC, Zod validation
on every endpoint, private-document upload rules, audit logs, soft deletes for financial
records, secrets only in env vars.

## 22. Testing

Strategy (TODO — suite not yet written):

- **Unit (implemented)**: permission map, invoice math (`computeInvoiceTotals`), dashboard range resolution (`resolveRange`), list-API sort allow-list (`sortFrom`) — run `npm run test` (vitest, `tests/*.test.ts`).
- **Integration**: API routes with a test MongoDB (` mongodb-memory-server`): auth, RBAC
  isolation, application stage flow, document review, payment constraints.
- **E2E** (Playwright): login for all three roles, student isolation, lead→student conversion.

Priority test matrix: student cannot access another student's application; employee cannot
access unassigned cases; employee cannot reach admin settings; rejected doc re-upload;
overpayment rejection.

## 23. Build & Deployment

```bash
npm run build   # compiles + typechecks; pages are dynamic (no DB needed at build)
npm run start
```

## 24. MongoDB Production Setup

Use MongoDB Atlas (or a replica set): create the cluster, a database user, and allow-list the
app IPs. `DATABASE_URL="mongodb+srv://user:pass@cluster/svms?retryWrites=true&w=majority"`.
Indexes are applied by `prisma db push`. Monitor slow queries and add indexes per real usage.

## 25. Deployment (Vercel + Atlas)

1. Push to Git; import the repo in Vercel.
2. Set env vars: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (production URL).
3. Deploy; then run `npx prisma db push && npm run seed` once against production (or seed via
   CI step). Remove seed demo users before go-live.

## 26. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Environment variable not found: DATABASE_URL` | Create `.env` from `.env.example` |
| `PrismaClientInitializationError` / connection refused | MongoDB not running / wrong URI |
| Login always fails | Check user status is ACTIVE and password hash; verify `AUTH_SECRET` |
| 403 on everything | Role check — see `lib/permissions/index.ts` |
| Prisma "relation field missing opposite" | Both sides of a relation must exist in the schema |
| Schema changed but types stale | `npx prisma generate` (and restart dev server) |
| Build fails on env | All DB pages are `force-dynamic`; ensure no top-level DB calls were added |
| File upload rejected | MIME/size validation is server-side by design |

## 27. Backup & Recovery

Atlas: continuous cloud backups or `mongodump --uri="$DATABASE_URL"` on schedule; test restores
quarterly. Keep audit/finance collections in the backup scope; soft deletes mean "deleted"
data is retained and must survive restores.

## 28. Future Development (roadmap hooks)

- Email automation (forgot-password delivery, stage-change emails) — `EMAIL_*` vars reserved.
- WhatsApp integration, AI/OCR document parsing, agent portal.
- Payment gateway (online card/bKash) building on the Invoice/Payment model.
- Multi-tenant SaaS — `organizationId` can be added to business entities; branch scoping
  already modeled; avoid queries that assume a single company.
- Mobile app — the REST API is role-scoped and ready.

## Architectural decisions

- **JWT sessions over database sessions**: keeps middleware edge-compatible; revocation
  tradeoff accepted for v1.
- **Server components read the DB directly via services** (not self-fetch); mutations go
  through `/api` route handlers so authorization and audit stay in one place.
- **Data-driven pipeline** (`ApplicationStage` table) so admins can reorder/disable stages
  without code changes.

## 29. Admin Panel (v2)

The admin panel is a full SaaS-style management console.

**Shell** (`components/shared/admin-shell.tsx`): collapsible sidebar (tablet-friendly),
mobile drawer, breadcrumbs derived from the URL, global search dialog (`/api/search` —
students, applications, universities, leads, invoices), notification bell with unread
count (60s polling), user dropdown menu, dark-mode toggle.

**Design system**: Radix-based Dialog/Drawer/Dropdown/Tabs/Toast primitives
(`components/ui/overlays.tsx`, `components/ui/toast.tsx`) on the existing semantic
Tailwind tokens. Reusable kit in `components/shared/`: `DataTable` (server-side
pagination + search + sorting + filters + column visibility + row actions + loading/
empty/error states, TanStack Query), `PageHeader`, `ConfirmDialog`, `FormDialog`
(RHF-style generic create/edit with server field-error surfacing), `StatCard`,
`StatusBadge`, `Pagination`, `EmptyState`.

**Dashboard** (`/admin`, data from `/api/admin/dashboard`): 10 KPI cards, charts
(country/stage/monthly registrations/monthly revenue/employee performance/visa
decisions), operational widgets (today's & overdue tasks, upcoming deadlines, recent
applications/payments/activities), date-range filter (today/7/30/90 days/year). All
figures come from real database aggregations — no static numbers.

**New API routes**: `/api/admin/dashboard`, `/api/employees(+/[id])`, `/api/branches(+/[id])`,
`/api/roles`, `/api/permissions`, `/api/intakes(+/[id])`, `/api/settings` (GET/PUT with
audit), `/api/audit-logs`, `/api/search`, `/api/visa` (visa application list + stage
updates that sync the linked application and write history).

**New permissions**: `employees.create/update/delete`, `audit_logs.read`, `roles.read`,
`dashboard.read`, `search.read`, `intakes.manage` — all enforced server-side in the
route handlers via `guard()`, never only by hiding buttons.

**New admin pages**: Employees (CRUD + performance detail page), Intakes (CRUD),
Branches (CRUD), Visa Management (tabs: visa applications with stage actions +
per-country requirements CRUD), Roles & Permissions (roles + full permission matrix),
System Settings (audit-logged key/value settings), Messages (conversation overview),
upgraded Leads/Students/Universities/Countries/Courses/Tasks/Payments/Invoices/Audit
to the DataTable standard with create/edit dialogs, confirm dialogs and toast feedback.

**Detail pages added**: Employee, University, Invoice (print-friendly layout, payments
breakdown). Student and Application detail pages were kept and already follow the
standard.

**Database changes**: added Prisma relations `Intake.course` ↔ `Course.intakes`,
`VisaApplication.application` ↔ `Application.visaApplication`, and
`Conversation.student/employee` ↔ back-relations (run `npx prisma db push` after
pulling). No destructive changes.

**Audit coverage added**: employee.created/updated/soft_deleted, branch.created/updated,
intake.created, setting.updated, country.updated.

**Sorting**: list endpoints accept `?sortBy=&sortOrder=` validated against a per-route
allow-list (`sortFrom` in `lib/api.ts`) to prevent arbitrary-key sorting.

**Known limitations / TODOs**: bulk row actions are not yet wired into DataTable (the
component supports extension); DateRangePicker beyond the preset ranges is TODO;
messaging compose UI is read-only overview; tests are still pending (see §22); employee
`name` sorting sorts via the related user.

## 30. Admin Dashboard (v2)

**API** (`/api/admin/dashboard`, permission `dashboard.read`): all statistics are
MongoDB aggregations executed server-side (`count`, `aggregate _sum`, `groupBy`) —
the browser never receives raw records for statistics. Includes:

- 10 KPIs (students, leads, applications, visa submitted/approved/refused, pending
  documents, outstanding payments, period revenue)
- Charts: applications by country / stage / **intake** (groupBy `intakeId` joined
  to `Intake.course` names), visa decision statistics, 12-month student
  registrations, 12-month revenue, employee performance (cases per counselor)
- Widgets: today's / overdue tasks, pending documents, upcoming deadlines, recent
  applications / payments / audit activity

**Range filtering**: presets Today / 7 / 30 / 90 Days / This Year plus a **custom
`from`/`to` date window**. Parsing lives in `lib/utils/dashboard-range.ts`
(`resolveRange`) as a pure function — unit-tested, with invalid/reversed windows
falling back to the default preset.

**Reusable components** (`components/dashboard/index.tsx`): `KpiGrid` (skeleton
loading), `ChartCard` (loading skeleton / empty / error + retry states baked in),
`WidgetCard` (title, count badge, skeleton), `DateRangeFilter` (presets + custom
inputs). The view (`app/admin/admin-dashboard-view.tsx`) composes them and is
responsive (2-col mobile → 5-col KPI grid on desktop).

**Tests**: `tests/dashboard-range.test.ts`, `tests/sort-from.test.ts`,
`tests/permissions.test.ts`, `tests/invoice-totals.test.ts` — 23 tests via
`npm run test` (vitest). Invoice totals were extracted into a pure
`computeInvoiceTotals` function so the finance math is testable without a
database; the route reuses it. DB-backed aggregation tests are TODO pending a
test MongoDB instance (`mongodb-memory-server`).

## 31. Leads Management (Admin, v2)

**Routes**: `/admin/leads` (list) and `/admin/leads/[id]` (detail). APIs:
`GET/POST/PUT /api/leads` (PUT = conversion pre-flight check),
`GET/PATCH/DELETE /api/leads/[id]`, `POST /api/leads/[id]/convert`.

**Enums** live in `lib/constants/leads.ts` (single source of truth shared by
validation, UI, and tests):

- Statuses: NEW, CONTACTED, COUNSELING, QUALIFIED, CONVERTED, LOST
- Sources: Website, Facebook, WhatsApp, Referral, Walk-in, Campaign, Agent, Other
- `conversionBlockReason()` — pure conversion guard (tested)

**List features**: server-side pagination, search (name/email/phone), filters
(status, source, interested country, assigned employee, preferred intake,
created-from/created-to date range, archived toggle), sortable columns via the
`sortFrom` allow-list, column visibility, row actions (View, Edit, Assign,
Status, Note, Convert, Archive/Unarchive), loading skeletons, empty and error
states — all through the shared `DataTable`.

**Lead detail page**: Overview (incl. conversion link), Contact, Academic
information, Interested destinations, Assigned employee, Tasks (of the
converted student), Notes, and an Activity timeline rendered from the lead's
audit trail (`AuditLog` where entity=Lead).

**Conversion** (`leadService.convertToStudent`): creates the Student (+ login),
sets the lead to CONVERTED with `convertedStudentId` linking back (history
preserved), blocks duplicates at three levels — pure guard, status/link check,
and a database-level email lookup that links to an existing student instead of
duplicating — and writes `lead.converted` / `lead.converted_existing_student`
audit entries. Converted leads become read-only (notes only) and cannot be
archived.

**Archive vs delete**: archive sets `archivedAt` (reversible, hides from the
default list, blocks conversion); DELETE remains a soft delete
(`deletedAt`/`deletedBy`). Audited as `lead.archived` / `lead.unarchived`.

**Database change**: `Lead.archivedAt` added — run `npx prisma db push`.
`Lead.source` is a plain string validated by the enum above.

**Business rules**: converted leads are immutable except notes; archived leads
cannot convert; status changes emit a dedicated `lead.status_changed` audit
entry for the timeline; all mutations require `leads.manage` (server-side).

**Tests**: `tests/leads.test.ts` — conversion guard (converted/archived/no-email
blocks), schema enum acceptance/rejection, archive flag on the update schema.
32 tests total via `npm run test`.

**Known limitations**: preferred-intake filter is free-text (intakes are
catalog-backed but leads store a plain string); notes are a single append-only
field rather than a relational note model; bulk actions not wired.

## 32. Student Management (Admin, v2 — Student 360)

**Routes**: `/admin/students` (list) and `/admin/students/[id]` (Student 360).
APIs: `GET/POST /api/students`, `GET/PATCH/DELETE /api/students/[id]`.

**List features**: server-side pagination, search (name/email/ID), sorting
(name/email/studentId/status/registered via `sortFrom` allow-list), and filters
for **country, employee, branch, application stage, student status, and a
registration date range**. Row actions: View, Edit, Assign Emp, Assign Branch,
Suspend, Activate, Archive.

**Admin actions** (all RBAC'd server-side via `students.*` permissions and
Zod-validated): Create Student (creates profile + login), Edit Student, Assign
Employee, Assign Branch, Create Application (student/country/priority dialog →
`POST /api/applications`), Suspend (`status: SUSPENDED`, blocks login),
Activate, Archive (soft delete — record + case history retained), and the full
case history on the 360 page.

**Student 360 page** sections: summary strip (current application + stage,
document completion % with progress bar, payment status, ), Profile, Passport
(**masked by default** with an explicit client-side reveal — sensitive-data
protection), Academic Background, English Proficiency, Applications, Documents,
Payments, Invoices, Tasks, Messages (conversations), merged **Application
Timeline** (all applications' status history) and **Audit Activity**
(`student.*` events).

**Pure helpers** (`lib/utils/student-insights.ts`, unit-tested):
`documentCompletion` (approved/rejected/pending/percent), `paymentStatus`
(aggregates invoices into PAID/PARTIAL/UNPAID), `maskPassport`.

**Service**: `studentService.update` writes profile/assignment/status changes
with audit entries — `student.updated` plus dedicated
`student.employee_assigned`, `student.branch_assigned`, and
`student.status_changed` events that feed the case-history timeline.
`softDelete` archives (`deletedAt`/`deletedBy`); no hard deletes.

**Validation**: `studentUpdateSchema` extends the create schema with
`branchId` and a status enum; `password` is stripped from updates.

**Tests**: `tests/students.test.ts` — document completion math, payment
classification and aggregation, passport masking rules (missing/short/normal),
and both schemas (required fields, email format, status enum, password not
patchable). 43 tests total via `npm run test`.

**Known limitations**: country filter matches the free-text residence country
against catalog names; messages section lists conversations only (compose UI
pending); suspend does not invalidate active sessions immediately (JWT
sessions expire naturally).

## 33. Employee Management (Admin, v2)

**Routes**: `/admin/employees` (list) and `/admin/employees/[id]` (profile +
performance dashboard). APIs: `GET/POST /api/employees`,
`GET/PATCH/DELETE /api/employees/[id]`, `POST /api/employees/[id]/reset-access`,
`PATCH /api/applications/[id]/assign`.

**List actions**: View, Edit, **Assign Role** (EMPLOYEE ↔ ADMIN),
**Assign Branch**, **Status** (activate/deactivate — sets the login status;
soft-delete remains available via the API), and **Reset Access**.

**Reset access** (`/reset-access`): replaces the password with a generated
temporary one (bcrypt-hashed; generated from an unambiguous alphabet and
policy-checked — see `generateTempPassword`), returns it **exactly once** to
the admin, and is audit-logged as `employee.access_reset`. Existing passwords
are never exposed or logged.

**RBAC**: all endpoints require `employees.read/create/update/delete`
(admin-only); role assignment additionally goes through `roleAssignmentError`
— admins cannot change their **own** role (lock-out protection) and student
accounts cannot receive staff roles. Audited as `employee.role_assigned`.

**Employee profile page**: Personal Information & Contact, Role, Branch,
Joining Date, Status, Workload (open/overdue tasks, pending documents, revenue
generated), **Assigned Students** and **Assigned Applications** tables, and
**Assign/Reassign panels** (students via `PATCH /api/students/[id]`,
applications via `PATCH /api/applications/[id]/assign` — both audited:
`student.employee_assigned`, `application.employee_assigned`).

**Performance dashboard** (all real aggregates): assigned cases, active cases,
completed cases, visa submissions, visa approvals, pending tasks, overdue
tasks, documents reviewed — as KPI cards plus a bar chart. Task statistics are
computed by the pure, unit-tested `computeTaskStats` helper.

**Tests**: `tests/employees.test.ts` — task stats (open/overdue/ignore
completed), role-assignment guard (valid, unknown roles, self-lock-out,
student accounts), temp-password generator (length, digit+letter policy,
unambiguous charset), and the employee update schema. 54 tests total.

**Known limitations**: status toggle does not invalidate existing JWT sessions
immediately; reset-access requires manual sharing of the temp password until
email automation lands.

## 34. Application Management (Admin, v2)

**Routes**: `/admin/applications` (list with **Table + Kanban** views) and
`/admin/applications/[id]` (detail). APIs: `GET/POST /api/applications`,
`GET/PATCH/DELETE /api/applications/[id]` (general edit + archive),
`PATCH /api/applications/[id]/status` (stage change), `PATCH /api/applications/[id]/assign`
(counselor), `POST /api/applications/[id]/notes`, `GET /api/stages` (live pipeline).

**Numbering**: `SV-YYYY-XXXXXX` generated server-side only via the pure,
unit-tested `formatApplicationNumber`/`parseApplicationNumber`
(`lib/constants/applications.ts`). Clients never supply application numbers.

**Dynamic pipeline**: stages live in the `ApplicationStage` table (18 seeded
defaults, admin-editable); the Kanban columns, filter options, and stage-change
forms all read `/api/stages` — nothing is hardcoded in UI components.

**Filters** (all server-side): country, university, course, employee, branch
(via the student's branch), stage, status, intake, priority, created-from/created-to
date range, plus free-text search on the application number and sortable columns.

**Kanban board**: horizontal stage columns with per-stage counts and colors,
cards linking to detail, a per-card stage-move select (goes through the same
audited `changeStage` service), and a focus-stage selector.

**Admin actions**: create (student/country/university/priority), edit
(university/intake/priority/status), assign employee, change stage, archive
(soft delete — history retained), and full timeline view. **Every stage change
creates an `ApplicationStatusHistory` entry** transactionally, notifies the
student, and audit-logs old → new.

**Detail page** sections: Student, University, Course, Intake, Country,
Documents, Visa, Tasks, Payments, Notes (with an add-note form; INTERNAL vs
STUDENT visibility), Timeline (status history), and the stage-change panel.

**Database change**: added Prisma relations `Application.university/course/intake`
with back-relations on `University/Course/Intake` — run `npx prisma db push`.
Non-destructive; scalar ids unchanged.

**Permissions**: reads need `applications.read`; create/edit/assign/stage/notes
need `applications.manage`; archive needs `applications.delete` — enforced
server-side in every handler.

**Tests**: `tests/applications.test.ts` — number formatting (padding, range
errors), number parsing (round-trip + malformed rejection), pipeline invariants
(18 unique stages, LEAD→COMPLETED), and the application schema (required fields,
priority enum/default). 61 tests total.

**Known limitations**: Kanban loads up to 100 applications per query (pagination
on scroll is TODO); Kanban stage-move uses a select rather than drag-and-drop;
course selection on create is inferred via the university later.
