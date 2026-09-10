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

Student role permissions include `universities.read`, `courses.read`, `countries.read`,
`visa.read` (catalog browsing), `documents.upload`, plus the student-only
`student.favorites` and `student.counseling` keys (no admin or employee mutations
are exposed under `/api/student/*`).

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
`courses(+/[id])`, `countries`, `countries/[id]`, `visa/requirements(+/[id])`,
`document-requirements(+/[id])`, `tasks(+/[id])`, `payments`, `invoices(+/[id])`,
`notifications`, `reports`, `student/universities`, `student/universities/[id]`,
`student/universities/meta`, `student/courses`, `student/courses/[id]`,
`student/courses/meta`, `student/intakes`, `student/favorites`, `student/counseling-requests`.

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
invoice.created, payment.recorded, university.created/updated, course.created,
country.created/updated/status_changed/archived/unarchived, visa_requirement.created/updated/deleted,
document_requirement.created/updated/deleted, university.favorited/unfavorited,
counseling_request.created, task.created. Viewable at `/admin/audit`.

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

## 35. Countries Management (Admin, v2)

**Routes**: `/admin/countries` (list) and `/admin/countries/[id]` (detail).
APIs: `GET/POST /api/countries`, `GET/PATCH/DELETE /api/countries/[id]`,
`GET/POST /api/visa/requirements` (with `?countryId=` filter),
`GET/PATCH/DELETE /api/visa/requirements/[id]`,
`GET/POST /api/document-requirements` (with `?countryId=` and `?appliesTo=` filters),
`GET/PATCH/DELETE /api/document-requirements/[id]`.

**List features** (all server-side via the shared `DataTable`): server-side
pagination, search (name/code/currency), filter by status (ACTIVE/INACTIVE),
archived toggle, sortable columns (name/code/status/createdAt via the `sortFrom`
allow-list), column visibility, row actions (**View, Edit, Status, Archive**),
loading skeletons, empty and error states, count columns (universities, active
applications, visa requirements).

**Row actions** (all RBAC'd server-side via `countries.manage` / `visa.manage` /
`documents.review`): View (link to detail), Edit (full form), Status
(activate ↔ deactivate via confirm dialog), Archive/Unarchive (confirm dialog
with active-application guard).

**Country detail page** sections (Radix `Tabs`):

- **Overview**: stat strip (universities, courses, active applications, visa
  requirements), about card (name/code/currency/status/timestamps/archived),
  description card, and an activity timeline rendered from the country's audit
  trail.
- **Universities**: server-rendered table of all universities in this country
  (links to each university detail page; shows ranking, course count, app count).
- **Courses**: server-rendered table of all courses across all universities in
  this country (degree level, tuition, English requirement).
- **Visa Requirements**: full CRUD via the `CountryVisaRequirements` client
  component (DataTable + FormDialog + ConfirmDialog). Admin can add, edit,
  delete visa requirements scoped to this country — name, description, required
  flag, sort order, status. The post goes to `/api/visa/requirements` with the
  `countryId` pre-set.
- **Document Requirements**: full CRUD via the `CountryDocumentRequirements`
  client component. Lists both country-scoped requirements and global
  requirements (no `countryId`) so the admin sees the complete effective rule
  set at a glance. Each requirement has a stable lowercase `code` (immutable
  on update), `appliesTo` (APPLICATION/VISA/PROFILE), `required`, and
  `status`. Hard-delete is blocked when documents reference the requirement —
  the API returns 409 with a clear message prompting the admin to deactivate
  instead.
- **Active Applications**: server-rendered table of in-flight applications
  (status=ACTIVE) targeting this country, with deep links into the application
  detail page and the owning student's record.

**Reusable CRUD components** (no per-page reimplementations): every list /
form / dialog / confirm / status pill goes through the shared `DataTable`,
`FormDialog`, `ConfirmDialog`, `PageHeader`, `StatusBadge`, `EmptyState`,
`TableShell`, and Radix `Tabs` primitives in `components/shared/` and
`components/ui/overlays.tsx`. The visa/document requirement CRUD components
follow the exact same shape as the existing `RequirementsAdmin` — only the
endpoint, country pre-scope, and column list differ.

**Pure helpers** (`lib/constants/countries.ts`, unit-tested):

- `COUNTRY_STATUSES`, `COUNTRY_STATUS_LABELS` — canonical enums + labels
  shared by validation, UI filters, and tests.
- `DOC_REQUIREMENT_SCOPES`, `DOC_REQUIREMENT_SCOPE_LABELS` — document
  requirement scope enums (APPLICATION / VISA / PROFILE).
- `normalizeCountryCode(code)` — trims and uppercases; safe for nullish input.
- `resolveCountryFlag(code, override)` — prefers an explicit `flag` override,
  falls back to the alpha-2 emoji via `countryFlag()`, returns null for
  alpha-3 codes with no override.
- `archiveBlockReason(country)` — pure pre-flight guard mirroring the
  server-side check: blocks archiving when active applications reference the
  country.
- `countrySlug(name)` — URL-friendly slug for deep-link anchors.

`countryFlag()` already existed in `lib/utils/country.ts` and remains the
low-level regional-indicator helper; `resolveCountryFlag()` is the higher-level
resolver that also honours the `Country.flag` override column.

**Validation** (`lib/validations/index.ts`):

- `countrySchema` now requires `code` to be 2-3 letters (regex `/^[A-Za-z]{2,3}$/`),
  caps name at 120 chars and description at 2000 chars, and accepts an optional
  `flag` override (max 16 chars).
- `countryUpdateSchema` is partial and accepts the `archived` boolean.
- `visaRequirementCreateSchema` / `visaRequirementUpdateSchema` — separated
  create vs update shapes. Update omits `countryId` (immutable on update).
  `sortOrder` is constrained to `>= 0` (was unconstrained before).
- `documentRequirementSchema` — `code` must be lowercase/digits/underscores
  (matches the existing seed convention), `appliesTo` defaults to APPLICATION.
- `documentRequirementUpdateSchema` — partial, omits `code` (immutable).
- The legacy `visaRequirementSchema` is kept as an alias of
  `visaRequirementCreateSchema` for backwards-compat with any external callers.

**API improvements**:

- `GET /api/countries` now supports `?archived=true` (was implicit), `?status=`
  filter, `?currency=` filter, and includes `_count` for universities,
  active applications, and visa requirements per row.
- `GET /api/countries/[id]` returns the full detail payload: universities (with
  course/app counts), visa requirements, document requirements (with country
  relation), and the latest 25 active applications (with student/university/
  course joins) — all in a single DB round-trip so the detail page renders
  without N+1 queries.
- `POST /api/countries` normalizes the code to uppercase + dedupe-checks name
  and code against active (non-archived) countries. Audit log entry records
  the new country's name/code/currency/status.
- `PATCH /api/countries/[id]` now writes a structured audit log entry comparing
  old vs new values (name/code/flag/currency/description/status). Status
  changes emit a *separate* `country.status_changed` audit entry so the
  timeline can surface activate/deactivate events distinctly from generic
  edits. Archive/unarchive is a separate code path with its own audit entry.
- `POST /api/visa/requirements` now uses `visaRequirementCreateSchema` (was
  raw body) and writes a `visa_requirement.created` audit log entry. Country
  existence is validated server-side (404 if missing).
- `PATCH /api/visa/requirements/[id]` uses `visaRequirementUpdateSchema`
  (countryId is now immutable on update).
- New `GET/POST /api/document-requirements` and `GET/PATCH/DELETE
  /api/document-requirements/[id]` routes — full CRUD with the
  `documents.read` / `documents.review` permissions, `?countryId=` /
  `?appliesTo=` / `?status=` filters on GET, audit logging on every mutation,
  and a 409 guard on DELETE when uploaded documents reference the requirement.

**RBAC**: reads need `countries.read` (admin + employee) / `visa.read` /
`documents.read`; mutations need `countries.manage` (admin) / `visa.manage`
(admin) / `documents.review` (admin + employee) — all enforced server-side in
every handler via `guard()`, never only by hiding buttons. The existing
`documents.review` permission was reused for document-requirement mutations
because managing the requirement catalog is a document-review responsibility
and avoids inventing a new permission key mid-release.

**Audit coverage added**: `country.created` (now records name/code/currency/
status), `country.updated` (structured old→new diff), `country.status_changed`
(distinct activate/deactivate event), `country.archived` / `country.unarchived`,
`visa_requirement.created` (new — was missing), `visa_requirement.updated`
(now with old/new diff), `document_requirement.created` / `.updated` /
`.deleted`.

**Database change**: added the back-relation `Country.documentRequirements` ↔
`DocumentRequirement.country` (plus `@@index([countryId])` and
`@@index([appliesTo])` on `DocumentRequirement`) — run `npx prisma db push`
after pulling. Non-destructive; scalar `countryId` column unchanged.

**Tests**: `tests/countries.test.ts` — 35 tests covering: country/doc-req
enum stability + labels, `normalizeCountryCode` (uppercasing, whitespace,
nullish), `countryFlag` (alpha-2 emoji, alpha-3 null), `resolveCountryFlag`
(override priority, fallback, trim), `archiveBlockReason` (no apps / N apps /
already archived), `countrySlug` (lowercase, dash trim, non-alphanumeric
replacement), and all five Zod schemas (required fields, code regex, status
enum, partial updates, immutability of `countryId` on visa update and `code`
on document-requirement update). 96 tests total via `npm run test`.

**Known limitations**: document-requirement `code` is immutable on update
(by design — codes are referenced by uploaded documents and audit logs); the
list page count of "Visa Reqs" only counts ACTIVE visa requirements (matches
the detail page's tab label); archived countries are still selectable by
existing in-flight applications but cannot be selected for new applications
(the catalog filters exclude `deletedAt != null`); hard-delete of a
document-requirement with uploaded documents is blocked — admins must
deactivate instead, preserving the historical join.

## 36. Student Universities Discovery (Module 07, v2)

**Goal**: a modern mobile-first university discovery and viewing experience
for students. Students browse universities curated by the agency — this is
NOT an unrestricted public marketplace. The agency controls which
universities are visible via the existing admin catalog (`status: ACTIVE`,
non-archived, parent country also ACTIVE).

**Routes**:
- `/student/universities` (list — mobile-first card UI)
- `/student/universities/[id]` (detail — tabbed sections)

**Student-facing APIs**:
- `GET /api/student/universities` — server-side search + filters, paginated
- `GET /api/student/universities/[id]` — full detail, internal admin
  fields stripped
- `GET /api/student/universities/meta` — filter option lists (countries,
  cities, max-ranking ceiling) for the filter sheet
- `GET/POST /api/student/favorites` — list + toggle favorites
- `POST /api/student/counseling-requests` — request counseling for a
  university (notifies the assigned counselor)

**Visibility rule** (single source of truth in
`lib/constants/universities.ts`): a university is student-visible only if
`status === "ACTIVE"`, `deletedAt === null`, AND its parent country has
`status === "ACTIVE"` and `deletedAt === null`. The rule is enforced at
the DB level in every student-facing query via `buildStudentUniversityWhere`
so deleted/archived/inactive universities never reach the response — even
cached client responses are safe. The pure `isUniversityVisibleToStudent`
helper is also exposed for UI pre-flight checks and is unit-tested
independently.

**University card** (mobile-optimized, reusable component):
- Logo (resolved via `resolveUniversityLogo`; falls back to a 2-letter
  initials avatar derived from `universityInitials` which strips corporate
  suffixes like "University", "of", "the")
- Name (links to detail)
- Country + city with globe icon
- Ranking chip with tier badge (Top 50 / Top 200 / Established via
  `rankingTier`)
- Course count chip
- Application fee chip (formatted via `formatApplicationFee` with
  `Intl.NumberFormat`)
- 3-line description excerpt
- Favorite heart toggle (optimistic UI via queryClient)
- "View details" + "Request counseling" action buttons
- Website link (truncated, external)

**Filters** (mobile bottom sheet via Radix `Drawer`):
- Country (dropdown — only countries with at least one visible university)
- City (dropdown — distinct cities across visible universities)
- Ranking ceiling (numeric input — `rankingMax`)
- Status filter intentionally NOT exposed to students (visibility is
  always ACTIVE-only)
- Course + Intake filters supported at the API level via `courseId` and
  `intakeId` query params (Prisma `some` joins on `courses` and
  `courses.intakes`) — UI hooks for these are TODO
- "Favorites only" toggle (shows only the student's saved universities)

Active filter chips render in a horizontally-scrollable row above the
list, each removable inline. Active count badge appears on the filter
trigger button. A "Clear all" link resets everything in one click.

**Search** (server-side): case-insensitive `contains` across name, city,
and country name — OR-combined in a single Prisma `OR` clause so a student
searching "Toronto" matches both universities named "Toronto" and
universities located in the city of Toronto. Whitespace is trimmed before
query.

**Sort**: dropdown inline with the search bar. Options: Name (A→Z),
Top ranked (asc), Highest fee (desc), Newest (desc). Default = name asc.

**Detail page** (`/student/universities/[id]`, server component with
embedded client action bar):

- Header card: logo + name + location + ranking chip + ACTIVE badge
- Action bar (client component): Save/Unsave heart, Request counseling
  button (disabled + status pill if already requested), Visit website link
- Tabs (Radix `Tabs`):
  - **Overview**: description card + quick-facts card (country, city,
    ranking, application fee, local currency, website link)
  - **Courses**: server-rendered table of active courses (name, level,
    duration, tuition, English requirements)
  - **Intakes**: server-rendered table of upcoming active intakes across
    all courses (intake name, course name, level, deadline)
  - **Requirements**: two side-by-side cards — document requirements
    (country-scoped + global) and visa requirements for the country.
    Each requirement shows scope (APPLICATION/VISA/PROFILE), required
    flag, and description.
  - **Application Info**: application fee, currency, course count, open
    intake count, and a "How to apply" callout explaining that students
    don't apply directly — they request counseling.

Internal administrative fields (`deletedAt`, `deletedBy`, internal
`_count`) are stripped from the API response so they never reach the
client.

**Student actions**:
- **View** — link to detail page
- **Save / Favorite** — POST `/api/student/favorites` toggles. Idempotent
  (unique constraint on `studentId_universityId`). Audit-logged as
  `university.favorited` / `university.unfavorited`. UI updates
  optimistically via `queryClient.setQueryData` and rolls back on error.
- **Request Counseling** — POST `/api/student/counseling-requests` creates
  a `CounselingRequest` row in `PENDING` status. Server-side guards:
  - student profile must exist
  - target university must be student-visible
  - if `courseId` is provided, it must belong to the target university
  - duplicate open requests (status PENDING or CONTACTED) for the same
    student+university are blocked with a 409 — the student must wait
    for their counselor to resolve or archive the existing request
  - the assigned counselor (if any) receives a `COUNSELING_REQUEST`
    notification with a deep link
- **View Courses** — same as "View" (the Courses tab is on the detail
  page)
- **No direct university database modification** — there is no admin
  mutation endpoint exposed under `/api/student/*`. The student role
  only has `universities.read`, `student.favorites`, and
  `student.counseling` permissions.

**Database changes** (run `npx prisma db push` after pulling):
- `University.city` (optional string) + `@@index([city])`
- `University.logo` (already existed; now exposed in the admin form)
- `UniversityFavorite` model — `@@unique([studentId, universityId])` so
  the toggle is idempotent
- `CounselingRequest` model — status PENDING → CONTACTED → RESOLVED |
  ARCHIVED lifecycle; indexed on studentId, universityId, status
- Back-relations added to `Student.universityFavorites` and
  `Student.counselingRequests`
- Back-relations added to `University.favorites` and
  `University.counselingRequests`

**New permissions** (`lib/permissions/index.ts`):
- `universities.read`, `courses.read`, `countries.read`, `visa.read` now
  include `STUDENT` (was ADMIN+EMPLOYEE only)
- New `student.favorites` (STUDENT-only) — gates favorite toggle + list
- New `student.counseling` (STUDENT-only) — gates counseling request
  creation

**Pure helpers** (`lib/constants/universities.ts`, unit-tested):
- `UNIVERSITY_VISIBILITY_STATUSES` — `["ACTIVE"]`
- `STUDENT_UNIVERSITY_SORTS` — allow-list for the `sortBy` query param
- `isUniversityVisibleToStudent(uni)` — pure visibility check
- `buildStudentUniversityWhere(filters)` — builds the Prisma `where`
  fragment enforcing visibility + AND-combining all optional filters
- `resolveUniversityOrderBy(sort)` — maps the sort key to a Prisma
  orderBy, with ranking ascending (lower = better) and everything else
  descending
- `formatApplicationFee(fee, currency)` — `Intl.NumberFormat` with safe
  fallback for invalid currency codes
- `rankingTier(ranking)` — categorizes into "top" (≤50) / "leading"
  (≤200) / "established" (>200) / null
- `resolveUniversityLogo(logo)` — URL validation with relative-path
  passthrough
- `universityInitials(name)` — strips corporate suffixes ("University",
  "Institute", "College", "School", "of", "the") and takes the first 2
  surviving words' initials

**Validation** (`lib/validations/index.ts`):
- `universitySchema` now accepts `city`, `logo`, and caps `description`
  at 5000 chars (was unbounded)
- `studentUniversityQuerySchema` — extends `paginationSchema` with
  countryId, city, rankingMax, courseId, intakeId, favoriteOnly, and
  sortBy. `pageSize` capped at 100 (rejects, not clamps).
- `counselingRequestSchema` — universityId required, courseId optional,
  message optional (max 2000 chars)
- `favoriteToggleSchema` — universityId required

**Audit coverage added**: `university.favorited`, `university.unfavorited`,
`counseling_request.created`. The admin-side `university.updated` audit
entry now records `city` in the old/new value diff.

**Mobile UX patterns** (per the brief):
- **Cards**: 1-column on mobile, 2-column on `sm+` screens. Each card is
  a self-contained unit with avatar, name, location, chips, description
  excerpt, and actions.
- **Horizontal chips**: filter chips scroll horizontally on mobile,
  removable inline. Sort dropdown is inline (not hidden in the filter
  sheet) because students change sort often.
- **Filter bottom sheet**: Radix `Drawer` slides in from the right.
  Applies on "Show results" button; pending filters are staged locally
  so closing without applying doesn't change the active filters.
- **Image/logo support**: `<img>` with `loading="lazy"` and an
  initials-avatar fallback when the logo URL is missing or invalid.
- **Expandable details**: description uses `line-clamp-3` on cards (CSS
  line clamp) and the detail page's Overview tab shows the full
  description with `whitespace-pre-wrap`.
- **Sticky search**: the search bar sticks to the top on mobile so it
  survives scroll (`sticky top-0 z-20` with backdrop blur).

**Responsive layout**: 1-col on mobile (`grid gap-4`), 2-col on `sm+`
(`sm:grid-cols-2`). Detail page uses `lg:grid-cols-2` / `lg:grid-cols-3`
grids for side-by-side card layouts on desktop. All interactive elements
meet the 44px tap-target minimum on mobile.

**Tests**: `tests/universities.test.ts` — 53 tests covering:
- Visibility enums + sort allow-list stability
- `isUniversityVisibleToStudent` (active/inactive/deleted/missing
  country/all combinations)
- `buildStudentUniversityWhere` (visibility predicates always present,
  search OR clause, country+city+ranking AND clauses, course + intake
  join filters, favorite-only with and without favorites, whitespace
  trimming)
- `resolveUniversityOrderBy` (every sort key + default + unknown fallback)
- `formatApplicationFee` (null/undefined, USD formatting, invalid
  currency fallback)
- `rankingTier` (null/0/negative, top/leading/established boundaries)
- `resolveUniversityLogo` (null, absolute URL, relative path, malformed,
  non-http schemes)
- `universityInitials` (suffix stripping, fallback to original, 2-char
  cap, multi-word handling)
- All four Zod schemas (required fields, optional fields, length caps,
  enum validation, coercion behavior)

149 tests total via `npm run test` (10 files).

**RBAC enforcement**: every student-facing API route uses `guard()` with
the appropriate permission key. The student layout (`app/student/layout.tsx`)
already restricts to ADMIN + STUDENT roles via `RoleLayout` — admins can
preview the student experience but employees are redirected to `/403`.

**Known limitations**: the city filter lists every distinct city across
all visible universities (not per-selected-country); the `courseId` and
`intakeId` filters are exposed at the API but not yet surfaced in the UI
filter sheet (deferred until a course-browser module lands); counseling
requests are visible to the assigned counselor via notification but
there's no employee-side inbox yet — they currently land in
`/employee/notifications`; the favorites list endpoint exists but the
"favorites only" filter is the only UI surface for it (a dedicated
"Saved Universities" page is TODO).

## 37. Student Courses & Intakes Discovery (Module 08, v2)

**Goal**: a mobile-first course browsing experience that lets students
explore programs across partner universities, see upcoming intakes with
deadline urgency, and request counseling for a specific course — without
ever exposing internal admin fields (no `deletedAt`, `deletedBy`, or
internal `_count` reach the client).

**Routes**:
- `/student/courses` (list — mobile-first card UI with filters + sort)
- `/student/courses/[id]` (detail — tabbed sections)

**Student-facing APIs** (all RBAC'd via `courses.read`):
- `GET /api/student/courses` — server-side search + filters + pagination
- `GET /api/student/courses/[id]` — full detail, visibility-guarded
- `GET /api/student/courses/meta` — filter option lists (countries,
  universities, degree levels, active intakes, tuition range)
- `GET /api/student/intakes` — intakes list with derived `startDate` and
  `deadlineUrgency` flags for highlighting approaching deadlines

**Visibility rule** (single source of truth in `lib/constants/courses.ts`):
a course is student-visible only if `status === "ACTIVE"` AND
`deletedAt === null` AND its parent university is ACTIVE + non-archived
AND the university's parent country is ACTIVE + non-archived. The
chained visibility (course → university → country) is enforced at the DB
level via nested Prisma `where` fragments in `buildStudentCourseWhere`,
so a single round-trip filters out invisible courses. The pure
`isCourseVisibleToStudent` helper mirrors that check for UI pre-flight
and unit tests.

**Course information shown** (per the brief):
- Course name
- Degree level (FOUNDATION / BACHELOR / MASTER / PHD / DIPLOMA)
- University + country + city
- Duration
- Tuition fee (with currency, formatted via `formatTuitionFee`)
- Currency
- Application fee
- IELTS / TOEFL / PTE requirements (structured fields, displayed as
  labeled rows via `collectEnglishRequirements`)
- Academic requirements
- Active intakes (count + "Open" / "Closed" status derived via
  `hasOpenIntake`)
- Application deadline (with urgency banner via
  `intakeDeadlineUrgency`)

**Database change** (run `npx prisma db push` after pulling): added three
structured English-test requirement fields to `Course`:
`ieltsRequirement`, `toeflRequirement`, `pteRequirement` (all optional
strings, max 200 chars). The legacy `englishRequirements` free-text field
is kept for backwards-compat — admin forms now expose all four fields, and
the detail page surfaces the structured fields as labeled rows with the
legacy note as a fallback. Non-destructive; existing courses continue to
work.

**Filters** (mobile bottom sheet via Radix `Drawer`):
- Country (dropdown — only countries with at least one visible course)
- University (dropdown — only universities with at least one visible
  course)
- Degree level (dropdown — FOUNDATION / BACHELOR / MASTER / PHD / DIPLOMA)
- Tuition range (min + max numeric inputs; the meta endpoint returns the
  available tuition range so the UI can show a hint)
- Intake (dropdown — every active intake across visible courses,
  formatted as "September 2026 — MSc CS (Manchester)")
- English requirement (dropdown — IELTS / TOEFL / PTE / "Has any English
  test" / Any)

Active filter chips render in a horizontally-scrollable row above the
list, each removable inline. A "Clear all" link resets everything.

**Sort**: inline dropdown with the search bar. Options: Name (A→Z),
Lowest tuition (asc), Degree level (asc), Newest (desc). Default = name asc.

**Intake display**: each intake row shows name, derived start date (first
day of the intake month in UTC, via `intakeStartDate`), application
deadline, and a status badge. Deadlines are highlighted by urgency:
- **urgent** (≤7 days) → red badge "Closes in ≤7 days"
- **soon** (≤30 days) → amber badge "Closes in ≤30 days"
- **past** → muted "Closed" badge
- **none** (no deadline) → green "Open (no deadline)" badge
- **normal** (>30 days) → muted "Open" badge

The course detail page's Application Info tab also renders an
`ApplicationDeadlineBanner` that mirrors the same urgency colour
treatment for the course-level `applicationDeadline` field.

**Mobile UX** (per the brief):
- **Course cards** are easy to scan: degree chip + course name at top,
  university + country line, chips for tuition / duration / intake
  status, English-requirement preview (first 2 tests), and
  "View details" + "Request counseling" actions at the bottom.
- 1-column on mobile → 2-column on `sm+` screens.
- Sticky search bar with backdrop blur on mobile.
- Horizontal filter chips scroll on mobile, each removable inline.
- Filter bottom sheet (Radix `Drawer`) stages pending filters locally so
  closing without applying doesn't change the active filters.
- Deadline urgency is surfaced both as a coloured badge on intake rows
  and as a coloured banner on the course detail page.

**Student actions** (no direct DB modification):
- **View** — link to detail page
- **View Courses** — same as "View" (the Courses tab is on the detail page)
- **Request Counseling** — POST `/api/student/counseling-requests` with
  both `universityId` and `courseId`. The endpoint is the same one used
  by the universities module — the counselor sees exactly which course
  the student is interested in. Duplicate-open-request guard returns 409.
- The course detail page also links to the parent university's detail
  page (`/student/universities/[id]`).

**Pure helpers** (`lib/constants/courses.ts`, unit-tested):
- `COURSE_DEGREE_LEVELS`, `COURSE_DEGREE_LABELS` — canonical enums
- `STUDENT_COURSE_SORTS` — sort allow-list for the `sortBy` query param
- `INTAKE_URGENCY_THRESHOLDS` — `urgentDays: 7`, `soonDays: 30`
- `isCourseVisibleToStudent(course)` — pure visibility check mirroring
  the DB-level rule (course + university + country all ACTIVE + non-
  archived)
- `buildStudentCourseWhere(filters)` — Prisma `where` fragment enforcing
  the visibility chain + AND-combining all optional filters (search,
  country, university, degree, tuition range, intake, englishTest)
- `resolveCourseOrderBy(sort)` — sort key → orderBy (tuition asc, others
  desc except name asc)
- `intakeStartDate(month, year)` — derives a UTC midnight Date for the
  first day of the intake month
- `formatShortDate(d)` — locale-aware DD Mon YYYY formatter with safe
  fallback for nullish/invalid input
- `intakeDeadlineUrgency(deadline, now)` — returns "urgent" / "soon" /
  "normal" / "past" / "none" based on the configured thresholds
- `formatTuitionFee(fee, currency)` — `Intl.NumberFormat` with safe
  fallback for invalid currency codes
- `collectEnglishRequirements(course)` — returns a sorted array of
  `{ test, label, value }` tuples for the populated English-test fields
- `hasOpenIntake(intakes, now)` — true when at least one active intake
  has a future deadline or no deadline (open)

**Validation** (`lib/validations/index.ts`):
- `courseSchema` now accepts `ieltsRequirement`, `toeflRequirement`,
  `pteRequirement` (all optional, max 200 chars). The legacy
  `englishRequirements` field is preserved.
- `studentCourseQuerySchema` — extends `paginationSchema` with countryId,
  universityId, degreeLevel, tuitionMin, tuitionMax, intakeId,
  englishTest (enum: ielts/toefl/pte/any), and sortBy (enum).
- `studentIntakeQuerySchema` — extends `paginationSchema` with
  countryId, universityId, courseId, and upcomingOnly. Omits the `status`
  field (intakes use their own ACTIVE filter).

**API improvements**:
- `GET /api/student/courses` — server-side search + 7 filters + pagination
  (max 24 per page). Each row is enriched with `englishRequirementsList`
  (via `collectEnglishRequirements`), `hasOpenIntake`, and
  `activeIntakeCount` so the UI card renders without extra queries.
- `GET /api/student/courses/[id]` — full detail with university, country,
  intakes, and English-test requirements. Internal admin fields
  (`deletedAt`, `deletedBy`) are stripped. The route also surfaces
  `counselingRequested` and `counselingRequestStatus` for the requesting
  student so the action bar can disable the duplicate-action button
  without a second call.
- `GET /api/student/courses/meta` — returns countries, universities,
  degree levels, active intakes (with course + university names), and
  the tuition-fee range (`_min.tuitionFee` / `_max.tuitionFee`) used to
  set the tuition-filter hint. Aggregate-only — no course records leaked.
- `GET /api/student/intakes` — paginated intakes across all student-
  visible courses, enriched with derived `startDate` and
  `deadlineUrgency`. Supports `upcomingOnly=true` to filter out past
  intakes (intakes with no deadline are kept — they're treated as
  "open").
- Admin-side `POST /api/courses` now audit-logs `course.created`.

**Audit coverage added**: `course.created` (new — admin course creation
was previously unlogged). Counseling requests initiated from the courses
module reuse the existing `counseling_request.created` audit action with
both `universityId` and `courseId` in the newValue.

**Tests**: `tests/courses.test.ts` — 74 tests covering:
- Course degree + sort enum stability
- `isCourseVisibleToStudent` (all combinations: course inactive, course
  deleted, university inactive, university deleted, country inactive,
  country deleted, missing university relation)
- `buildStudentCourseWhere` (visibility chain always present, search OR
  clause across course/university/country, country+university+degree AND
  clauses, tuition range (both bounds inclusive, single-sided min/max),
  intake join with active-intake guard, englishTest filter for each of
  ielts/toefl/pte/any, no englishTest clause when filter missing)
- `resolveCourseOrderBy` (every sort key + default + unknown fallback)
- `intakeStartDate` (September, January, null month/year, out-of-range
  month, out-of-range year)
- `formatShortDate` (nullish, invalid, valid Date, ISO string)
- `intakeDeadlineUrgency` (urgent ≤7d, soon ≤30d, normal >30d, past,
  none, invalid date, default-now)
- `formatTuitionFee` (nullish, USD formatting, invalid currency
  fallback, default currency)
- `collectEnglishRequirements` (empty, all three, mixed null/populated)
- `hasOpenIntake` (empty/null, future deadline, no deadline = open,
  all past, INACTIVE ignored)
- `studentCourseQuerySchema` (full query, defaults, negative page,
  negative tuition, unknown englishTest, unknown sortBy, "any"
  meta-filter)
- `studentIntakeQuerySchema` (full query, status field omitted,
  defaults, boolean upcomingOnly)
- `courseSchema` (new English-test fields, no requirements, 200-char
  cap, invalid degreeLevel, default status)

223 tests total via `npm run test` (11 files).

**RBAC enforcement**: every student-facing API route uses `guard()` with
`courses.read` (which now includes the STUDENT role — see Module 07's
permissions change). The student layout restricts to ADMIN + STUDENT
roles; employees are redirected to `/403` (they have their own course
browser at `/employee/courses`).

**Known limitations**: the intake `upcomingOnly` filter is applied
client-side after the DB query (because a null deadline means "open" —
a server-side `gte: now` would exclude those); the tuition range filter
excludes courses with a null `tuitionFee` (intentional — students
filtering by tuition want concrete numbers); the meta endpoint's
intake list is capped at the default Prisma limit (no pagination) since
the filter dropdown needs all active intakes at once — fine for the
expected scale but worth revisiting if intake counts grow large.
