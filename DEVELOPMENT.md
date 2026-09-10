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
application.created/stage_changed, document.uploaded/approved/rejected/under_review/reupload_requested/
archived/unarchived, invoice.created, payment.recorded,
university.created/updated/status_changed/archived/unarchived,
course.created/updated/status_changed/archived/unarchived,
intake.created/updated/status_changed/archived/unarchived,
visa_application.created/stage_changed/updated/archived,
country.created/updated/status_changed/archived/unarchived, visa_requirement.created/updated/deleted,
document_requirement.created/updated/deleted, university.favorited/unfavorited,
counseling_request.created, task.created/updated/status_changed/assigned/archived.
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

## 38. Admin University Management (v2)

**Routes**: `/admin/universities` (list) and `/admin/universities/[id]`
(detail). APIs: `GET/POST /api/universities`, `GET/PATCH/DELETE
/api/universities/[id]`.

**Fields managed** (per the brief): Name, Slug (auto-derived, immutable
after creation), Country, Logo (URL), Website, Description, Ranking,
Application Fee, Status (ACTIVE/INACTIVE). The model also carries an
optional `city` field used by the student-facing discovery module
(Module 07) and surfaced in the admin list/form.

**List features** (all server-side via the shared `DataTable`):
- server-side pagination (default 20/page)
- search across name, city, AND country name (OR-combined, case-
  insensitive) — so searching "Manchester" matches universities named
  "Manchester", universities in the city of Manchester, and universities
  in a country named "Manchester" (edge case, but free)
- filter by Status (ACTIVE/INACTIVE) and by Country (dropdown)
- sortable columns via the `sortFrom` allow-list: name, ranking,
  applicationFee, status, createdAt
- archived toggle (`?archived=true`) to view soft-deleted universities
- column visibility, loading skeletons, empty + error states
- row actions: **View** (link to detail), **Edit** (full form),
  **Status** (activate ↔ deactivate via confirm dialog), **Archive**
  (confirm dialog with active-application guard)
- per-row counts: courses, active applications

**Row actions** (all RBAC'd server-side via `universities.read` /
`universities.manage`): View, Edit, Status (activate/deactivate),
Archive/Unarchive. Archive is blocked when active applications reference
the university — the admin must deactivate instead so in-flight
applications retain their data.

**University detail page** sections (Radix `Tabs`):

- **Overview**: stat strip (ranking, application fee, courses count,
  active applications count), about card (name, slug, country link,
  city, ranking, status, created/updated/archived timestamps),
  description card, and an activity timeline rendered from the
  university's audit trail (`AuditLog` where entity=University, latest
  30 events).
- **Courses**: full CRUD via the `UniversityCourses` client component
  (DataTable + FormDialog + ConfirmDialog). Admin can add, edit, and
  delete (soft-delete) courses belonging to this university. The
  universityId is injected into every payload so the admin doesn't
  re-select it per course. Each course row shows name, degree level,
  duration, tuition (with currency), intake count, application count,
  application deadline, and status. Course deletion is blocked when
  active applications reference the course (409 with a clear message).
- **Intakes**: server-rendered table of all active intakes across this
  university's courses (intake name, course name, level, month/year,
  deadline).
- **Requirements**: two side-by-side cards — document requirements
  (country-scoped + global, with scope + required flag) and visa
  requirements for the university's country.
- **Application Fee**: application fee (formatted with Intl.NumberFormat
  in the country's currency), country currency, course count, and a
  "How application fees work" callout explaining the fee is what
  students pay the university on submission (separate from tuition,
  typically non-refundable, recorded against the application in the
  Finance module).
- **Active Applications**: server-rendered table of in-flight
  applications (status=ACTIVE) targeting this university, with deep
  links into the application detail page and the owning student's
  record.

**Reusable CRUD components** (no per-page reimplementations): every
list/form/dialog/confirm/status pill goes through the shared `DataTable`,
`FormDialog`, `ConfirmDialog`, `PageHeader`, `StatusBadge`, `EmptyState`,
`TableShell`, and Radix `Tabs` primitives. The university-scoped course
manager (`UniversityCourses`) follows the exact same shape as the
country-scoped visa/document requirement managers from Module 06.

**Pure helpers** (`lib/constants/universities-admin.ts`, unit-tested):

- `UNIVERSITY_STATUSES`, `UNIVERSITY_STATUS_LABELS` — canonical enums +
  labels shared by validation, UI filters, and tests.
- `UNIVERSITY_SORT_KEYS` — sort allow-list for the `sortFrom` helper.
- `normalizeSlug(name)` — lowercases, strips non-alphanumerics, collapses
  separators, trims dashes. Returns "" for nullish input. Used to derive
  the slug suffix at create time (`${normalizeSlug(name)}-${timestamp36}`).
- `archiveBlockReason(university)` — pure pre-flight guard mirroring the
  server-side check: blocks archiving when active applications reference
  the university; blocks when already archived (with priority over the
  applications check).
- `buildAdminUniversityWhere(filters)` — Prisma `where` fragment for the
  admin list. Enforces the soft-delete filter (deletedAt null vs not-null
  based on the `archived` toggle) and AND-combines search, status, and
  countryId filters.
- `formatFee(fee, currency)` — `Intl.NumberFormat` with safe fallback
  for invalid currency codes.
- `isValidSlug(slug)` — regex validator for the slug contract (lowercase
  letters, digits, dashes; no leading/trailing/consecutive dashes).

**Validation** (`lib/validations/index.ts`):

- `universitySchema` requires name + countryId; caps name at 160 chars
  and description at 5000; validates website + logo as URLs (or empty);
  ranking must be a positive integer; applicationFee must be
  non-negative; status defaults to ACTIVE.
- `universityUpdateSchema` is partial and accepts the `archived` boolean.
  `slug` is intentionally NOT in the update schema — slugs are
  immutable after creation (referenced by external systems and audit
  logs).

**API improvements**:

- `GET /api/universities` now supports `?archived=true` (was implicit),
  `?status=` filter, `?countryId=` filter, search across name/city/
  country, and includes `_count` for courses and active applications
  per row. Uses `buildAdminUniversityWhere` so the visibility rule lives
  in one place.
- `GET /api/universities/[id]` returns the full detail payload: country,
  courses (with intake + application counts), active applications (with
  student + course joins, latest 25), and the audit activity timeline
  (latest 30 events). All in a single DB round-trip so the detail page
  renders without N+1 queries.
- `POST /api/universities` validates the referenced country exists and
  is not archived (404 if missing), dedupe-checks the name within the
  same country (case-insensitive, 409 on conflict — two universities in
  different countries CAN share a name), derives the slug from the name
  + a timestamp suffix for uniqueness, and audit-logs the creation with
  name/slug/countryId/ranking/status.
- `PATCH /api/universities/[id]` has a separate archive/unarchive code
  path (with the active-application guard returning 409) distinct from
  field updates. Field updates write a structured old→new audit diff
  (name/countryId/website/city/logo/description/ranking/applicationFee/
  status). Status changes emit a *separate* `university.status_changed`
  audit entry so the timeline can surface activate/deactivate events
  distinctly from generic edits. Name dedupe-check is case-insensitive
  within the same country. Country existence is validated when countryId
  is changed.
- `DELETE /api/universities/[id]` is the archive path (soft delete).
  Blocked when active applications reference the university (409 with a
  clear message prompting the admin to deactivate instead). Audit-logs
  `university.archived` with the old name + slug.

**RBAC**: reads need `universities.read` (admin + employee + student);
mutations (create/edit/archive/status) need `universities.manage`
(admin-only) — all enforced server-side in every handler via `guard()`.

**Audit coverage added**: `university.created` (now records
name/slug/countryId/ranking/status), `university.updated` (structured
old→new diff), `university.status_changed` (distinct activate/deactivate
event), `university.archived` / `university.unarchived`. The course
mutations also gained `course.updated` / `course.status_changed` /
`course.deleted` audit entries (with the same active-application guard
on delete).

**Tests**: `tests/universities-admin.test.ts` — 48 tests covering:
- University status + sort enum stability + labels
- `normalizeSlug` (lowercasing, separator collapse, dash trim, digit
  preservation, nullish/blank input, underscore stripping behaviour)
- `archiveBlockReason` (no apps, N apps, already archived, priority of
  the already-archived check over the applications check)
- `buildAdminUniversityWhere` (archived toggle, status filter, countryId
  filter, search OR clause across name/city/country, whitespace
  trimming, AND-chain combination, status clause omission when
  undefined)
- `formatFee` (nullish, USD formatting, default currency, invalid
  currency fallback, thousands separators)
- `isValidSlug` (valid slugs, uppercase rejection, leading/trailing
  dash rejection, consecutive-dash rejection, non-alphanumeric
  rejection, nullish/empty rejection)
- `universitySchema` (required fields, default status, city/logo
  acceptance, URL validation, empty-website handling, non-positive
  ranking rejection, negative fee rejection, name/description length
  caps, invalid status rejection)
- `universityUpdateSchema` (partial acceptance, archived flag, field
  validation, multi-field updates, slug immutability on update)

271 tests total via `npm run test` (12 files).

**Known limitations**: the slug is immutable after creation (by design
— slugs are referenced by external systems and audit logs); the name
dedupe-check is case-insensitive within a single country but not across
countries (two universities in different countries CAN share a name);
the archived toggle is a binary switch (no "archived + inactive" mixed
view); the course manager on the detail page loads up to 100 courses
per university (pagination on scroll is TODO); the activity timeline is
capped at 30 events (older events are accessible via the global
`/admin/audit` page filtered by entity=University).

## 39. Admin Course & Intake Management (v2)

**Routes**: `/admin/courses` (list), `/admin/courses/[id]` (detail),
`/admin/intakes` (list). APIs: `GET/POST /api/courses`,
`GET/PATCH/DELETE /api/courses/[id]`, `GET/POST /api/intakes`,
`GET/PATCH/DELETE /api/intakes/[id]`.

**Degree levels** (updated): `DIPLOMA`, `BACHELOR`, `MASTER`, `PHD`,
`OTHER`. The old `FOUNDATION` level has been replaced with `OTHER`
across the schema, validation, UI, and tests. Existing courses with
`FOUNDATION` degree level will need a manual data migration (or are
treated as invalid on next edit).

**Course fields managed**: Name, Slug (auto-derived, immutable),
University, Degree Level, Duration, Tuition Fee, Currency, Application
Fee, IELTS Requirement, TOEFL Requirement, PTE Requirement, Academic
Requirements, Application Deadline, Status (ACTIVE/INACTIVE).

**Intake fields managed**: Name, Start Date (month + year, displayed as
"Sep 2026"), Application Deadline, University (via course), Course,
Status (ACTIVE/INACTIVE).

**Course list features** (all server-side via the shared `DataTable`):
- search across course name, university name, AND country name
- **6 filters**: Status, Country, University, Degree Level, Tuition
  Range (min + max), English Requirement (IELTS/TOEFL/PTE/Any), and
  Intake (dropdown of all active intakes)
- sortable columns: name, tuitionFee, degreeLevel, status, createdAt
- archived toggle (`?archived=true`) to view soft-deleted courses
- row actions: View, Edit, Status (activate/deactivate), Archive
- per-row counts: active intakes, active applications

**Intake list features**:
- search across intake name, course name, AND university name
- filters: Status, Country, University, Course
- sortable columns: name, year, month, deadline, status, createdAt
- archived toggle
- row actions: Edit, Status, Archive
- deadline urgency highlighting (red ≤7 days, amber ≤30 days)

**Course detail page** (`/admin/courses/[id]`, tabbed):
- **Overview**: stat strip (tuition, app fee, active intakes, active
  apps), course details card (name, degree, university link, duration,
  tuition, app fee, status, timestamps), requirements card (IELTS,
  TOEFL, PTE, legacy note, academic requirements), and an application
  deadline urgency banner
- **Intakes**: server-rendered table of active intakes with start date,
  deadline, urgency badge, and application count
- **Active Applications**: server-rendered table of in-flight
  applications with deep links to application + student detail pages
- **Activity**: audit timeline (latest 30 events for this course)

**API improvements**:
- `GET /api/courses` — full filter set (countryId, universityId,
  degreeLevel, tuitionMin/tuitionMax, englishTest, intakeId, status),
  archived toggle, per-row counts (intakes, applications), proper
  sorting via `sortFrom` allow-list. Uses `buildAdminCourseWhere`.
- `GET /api/courses/[id]` (new) — full detail: university + country,
  active intakes (with app counts), active applications (latest 25
  with student joins), audit activity timeline (latest 30). Single DB
  round-trip, no N+1.
- `POST /api/courses` — validates university exists + not archived
  (404 if missing), audit-logs creation.
- `PATCH /api/courses/[id]` — separate archive/unarchive path (with
  active-application guard returning 409), structured old→new audit
  diff, distinct `course.status_changed` event, university existence
  validation when universityId is changed.
- `DELETE /api/courses/[id]` — soft delete blocked when active
  applications reference the course (409).
- `GET /api/intakes` — full filter set (countryId, universityId,
  courseId, status), archived toggle, proper pagination + sorting via
  `sortFrom` allow-list. Uses `buildAdminIntakeWhere`.
- `GET /api/intakes/[id]` (new) — full detail: course + university +
  country, application count, audit activity timeline.
- `POST /api/intakes` — validates course exists + not archived (404
  if missing), audit-logs creation.
- `PATCH /api/intakes/[id]` — separate archive/unarchive path (with
  application-reference guard returning 409), structured old→new
  audit diff, distinct `intake.status_changed` event, course existence
  validation when courseId is changed.
- `DELETE /api/intakes/[id]` — changed from hard-delete to soft-delete
  (archive). Blocked when applications reference the intake (409).

**Database change** (run `npx prisma db push` after pulling): added
`deletedAt` and `deletedBy` fields to the `Intake` model, plus
`@@index([status])` and `@@index([year])`. Non-destructive — existing
intakes continue to work (the new fields default to null).

**Pure helpers** (`lib/constants/courses-admin.ts`, unit-tested):
- `COURSE_STATUSES`, `COURSE_STATUS_LABELS`, `ADMIN_COURSE_SORT_KEYS`
- `INTAKE_STATUSES`, `INTAKE_STATUS_LABELS`, `ADMIN_INTAKE_SORT_KEYS`
- `ENGLISH_TEST_FILTERS` — `["ielts", "toefl", "pte", "any"]`
- `buildAdminCourseWhere(filters)` — Prisma `where` fragment with
  archived toggle + AND-combined search/status/country/university/
  degree/tuition-range/englishTest/intake filters
- `buildAdminIntakeWhere(filters)` — Prisma `where` fragment with
  archived toggle + AND-combined search/status/country/university/
  course filters
- `courseArchiveBlockReason(course)` — pure pre-flight guard: blocks
  when active applications reference the course; blocks when already
  archived (with priority)
- `intakeArchiveBlockReason(intake)` — pure pre-flight guard: blocks
  when applications reference the intake; blocks when already archived
- `formatTuition(fee, currency)` — `Intl.NumberFormat` with safe fallback
- `intakeStartLabel(month, year)` — human-readable start date label

**Validation**:
- `courseSchema` — degreeLevel enum updated to `["DIPLOMA", "BACHELOR",
  "MASTER", "PHD", "OTHER"]`. Added `applicationDeadline` as an optional
  coerced date field. English-test fields capped at 200 chars.
- `courseUpdateSchema` — partial + `archived` boolean flag.
- `intakeSchema` — unchanged (courseId, name, month, year, deadline,
  status).
- `intakeUpdateSchema` — partial + `archived` boolean flag.

**Audit coverage added**: `course.created` (now records tuitionFee),
`course.updated` (structured old→new diff with all fields),
`course.status_changed`, `course.archived` / `course.unarchived`,
`intake.created` (now records month/year/deadline), `intake.updated`
(structured old→new diff), `intake.status_changed`,
`intake.archived` / `intake.unarchived`.

**Tests**: `tests/courses-admin.test.ts` — 65 tests covering admin
enums (course + intake statuses, sort keys, english-test filters),
`buildAdminCourseWhere` (archived toggle, status/degree/university/
country filters, search OR clause, tuition range, englishTest
variants, intake filter, full AND-chain combination),
`buildAdminIntakeWhere` (archived toggle, status/course/university/
country filters, search OR clause), `courseArchiveBlockReason`
(no apps, N apps, already archived, priority),
`intakeArchiveBlockReason` (no apps, N apps, already archived),
`formatTuition` (nullish, USD, default currency, invalid fallback),
`intakeStartLabel` (valid month/year, nullish, out-of-range),
`courseSchema` (required fields, OTHER acceptance, FOUNDATION rejection,
invalid degree rejection, default status, all fields, negative tuition,
200-char cap), `courseUpdateSchema` (partial, archived flag, validation,
multi-field), `intakeSchema` (required fields, month/year validation,
deadline acceptance, default status), `intakeUpdateSchema` (partial,
archived flag, validation, multi-field). Existing `tests/courses.test.ts`
updated to use the new `OTHER` degree level instead of `FOUNDATION`.

336 tests total via `npm run test` (13 files).

**Known limitations**: the degree-level change from `FOUNDATION` to
`OTHER` requires a manual data migration for existing courses (they'll
fail validation on next edit if still set to `FOUNDATION`); the
intake "Start Date" is derived from month + year rather than a
dedicated `DateTime` field (intentional — keeps the form simple and
the derivation is testable); the tuition range filter excludes courses
with a null `tuitionFee` (intentional — admins filtering by tuition
want concrete numbers); the course detail page's "View" action
navigates to `/admin/courses/[id]` but there's no equivalent intake
detail page (intakes are managed inline from the list).

## 40. Admin Document Management (v2)

**Routes**: `/admin/documents` (list). APIs: `GET/POST /api/documents`,
`GET/PATCH/DELETE /api/documents/[id]`, `PATCH /api/documents/[id]/review`,
`POST /api/documents/[id]/reupload`, `GET /api/documents/meta`.

**Statuses**: REQUESTED → UPLOADED → UNDER_REVIEW → APPROVED | REJECTED
→ (re-upload) ↘ EXPIRED.

**Document list features** (all server-side via the shared `DataTable`):
- search across document name, file name, and student name
- **6 filters**: Status, Country, Application, Student, Employee, Date
  range (uploadedFrom / uploadedTo)
- sortable columns: name, status, uploadedAt, reviewedAt, expiresAt,
  createdAt
- archived toggle to view soft-deleted documents
- row actions: Approve, Reject, Re-upload, Archive
- per-row columns: Document (name + file name + file size), Student
  (name + ID), Application (number + country), Status badge, Uploaded
  date, Reviewed date, Expiry date (red if past)

**Document review workflow**:
- **Approve**: sets status to APPROVED, records reviewer + timestamp,
  optional note. Notifies the student. Audit-logged as
  `document.approved`.
- **Reject**: REQUIRES a reason (enforced by `documentReviewSchema` Zod
  refine). Sets status to REJECTED, records reviewer + timestamp + note.
  Notifies the student with the rejection reason so they can fix and
  re-upload. Audit-logged as `document.rejected`.
- **Request Re-upload**: REQUIRES a reason (enforced by
  `documentReuploadSchema`). Resets status to REQUESTED, records the
  admin's reason as the reviewNote. Notifies the student. Can be used
  on any non-archived, non-REQUESTED, non-EXPIRED document — including
  APPROVED documents (implicitly revokes the approval). Audit-logged
  as `document.reupload_requested`.
- **Archive**: soft-deletes the document (sets `deletedAt` + `deletedBy`).
  Archived documents retain their data for audit trails. Audit-logged
  as `document.archived` / `document.unarchived`.

**Business rules** (enforced server-side in `documentService`):
- Only REVIEWABLE statuses (UPLOADED, UNDER_REVIEW, REJECTED) can be
  approved/rejected. APPROVED documents cannot be rejected — they must
  first be revoked via "Request Re-upload" which resets the status to
  REQUESTED. This prevents approved documents from being silently
  replaced.
- Rejection always requires a reason — the student must be told why
  their document was rejected.
- File type validation: only PDF, JPEG, PNG, WebP are allowed
  (`ALLOWED_MIME_TYPES` in `lib/constants/documents.ts`).
- File size validation: max 10 MB (`MAX_FILE_SIZE`).
- Authorization: students can only see and upload their own documents.
  The `GET /api/documents` endpoint auto-scopes to the student's own
  ID when the caller is a STUDENT.
- Private documents: the `fileUrl` is NEVER returned in the `GET
  /api/documents/[id]` response. The admin UI uses the metadata
  endpoint for the review panel; actual file serving goes through a
  separate secure-file endpoint (TODO — production should use signed
  URLs with expiry).

**Pure helpers** (`lib/constants/documents.ts`, unit-tested):
- `DOCUMENT_STATUSES`, `DOCUMENT_STATUS_LABELS` — canonical enums +
  labels shared by validation, UI filters, and tests.
- `ALLOWED_MIME_TYPES` — PDF, JPEG, PNG, WebP.
- `MAX_FILE_SIZE` — 10 MB (10 × 1024 × 1024 bytes).
- `REVIEWABLE_STATUSES` — `["UPLOADED", "UNDER_REVIEW", "REJECTED"]`.
- `DOCUMENT_SORT_KEYS` — sort allow-list for the admin list.
- `isReviewable(status)` — true for UPLOADED / UNDER_REVIEW / REJECTED.
- `canRequestReupload(status)` — true for any non-REQUESTED, non-EXPIRED
  status (including APPROVED).
- `canReject(status)` — false for APPROVED and EXPIRED.
- `validateFileMeta(mimeType, fileSize)` — returns an error message
  string when invalid, null when valid. Used by both the service layer
  and the upload schema.
- `formatFileSize(bytes)` — human-readable B / KB / MB.
- `buildAdminDocumentWhere(filters)` — Prisma `where` fragment with
  archived toggle + AND-combined search/status/country/application/
  student/employee/date-range filters.

**Validation** (`lib/validations/index.ts`):
- `documentUploadSchema` — requires studentId, name, fileUrl, fileName,
  mimeType, fileSize. Max 10MB.
- `documentReviewSchema` — decision enum (APPROVED / REJECTED /
  UNDER_REVIEW) + optional reviewNote. Uses `.refine()` to enforce
  that REJECTED requires a non-empty reviewNote.
- `documentReuploadSchema` — requires a `reason` (min 1, max 2000 chars).
- `documentArchiveSchema` — requires a boolean `archived`.

**API improvements**:
- `GET /api/documents` — full filter set (search, status, countryId,
  applicationId, studentId, employeeId, uploadedFrom/uploadedTo date
  range, archived toggle). Uses `buildAdminDocumentWhere` so the filter
  logic lives in one place. Students are auto-scoped to their own
  documents.
- `GET /api/documents/[id]` (new) — returns document metadata with
  student, application, and requirement joins. The `fileUrl` is stripped
  from the response so private documents are never publicly accessible.
  Students can only access their own documents.
- `PATCH /api/documents/[id]` (new) — archive/unarchive toggle via the
  `archived` boolean in the body.
- `DELETE /api/documents/[id]` — archive (soft delete). Same as
  `PATCH { archived: true }`. Retains data for audit trails.
- `PATCH /api/documents/[id]/review` — uses the new
  `documentReviewSchema` which enforces rejection reason. Delegates to
  `documentService.review` which enforces the APPROVED-can't-be-rejected
  rule.
- `POST /api/documents/[id]/reupload` (new) — request re-upload with a
  required reason. Delegates to `documentService.requestReupload` which
  resets status to REQUESTED, notifies the student, and audit-logs.
- `GET /api/documents/meta` (new) — returns filter options (countries,
  students, applications, employees) that have at least one document.
  Aggregate-only — no document records are leaked.

**Audit coverage added**: `document.uploaded` (existing, now via
service), `document.approved` / `document.rejected` /
`document.under_review` (existing, now with status guards),
`document.reupload_requested` (new), `document.archived` /
`document.unarchived` (new).

**Tests**: `tests/documents.test.ts` — 51 tests covering:
- Document status + MIME type + sort enum stability + labels
- `isReviewable` (UPLOADED/UNDER_REVIEW/REJECTED = true; REQUESTED/
  APPROVED/EXPIRED = false)
- `canRequestReupload` (all non-REQUESTED/EXPIRED = true, including
  APPROVED)
- `canReject` (false for APPROVED and EXPIRED)
- `validateFileMeta` (valid PDF/image, disallowed MIME types, file
  exceeding 10MB, file at exactly 10MB)
- `formatFileSize` (nullish, B, KB, MB boundaries)
- `buildAdminDocumentWhere` (archived toggle, status/country/application/
  student/employee filters, search OR clause, date range with both
  bounds and single-sided, full AND-chain combination)
- `documentUploadSchema` (required fields, 10MB limit, negative file
  size, optional applicationId/requirementId)
- `documentReviewSchema` (APPROVED without note, REJECTED without/with
  empty/whitespace reason = rejected, REJECTED with reason = accepted,
  unknown decision, optional note for APPROVED, 2000-char cap)
- `documentReuploadSchema` (requires reason, empty rejected, 2000-char
  cap)
- `documentArchiveSchema` (requires boolean, rejects non-boolean)

387 tests total via `npm run test` (14 files).

**Known limitations**: the `fileUrl` is currently stored as a plain
string in the DB and is NOT exposed in the `GET /api/documents/[id]`
response (stripped for security). Production file serving should use
signed URLs with expiry — this is a TODO pending object-storage
integration (`STORAGE_*` env vars are reserved). The document detail
page (`/admin/documents/[id]`) is not yet built — the admin reviews
documents inline from the list view's row actions + dialogs. The
document upload endpoint (`POST /api/documents`) still accepts a
pre-uploaded `fileUrl` — actual file upload handling (multipart form
data → object storage) is a separate TODO.

## 41. Admin Visa Management (v2)

**Routes**: `/admin/visa` (list + requirements tabs),
`/admin/visa/[id]` (detail). APIs: `GET/POST/PATCH /api/visa`,
`GET/PATCH/DELETE /api/visa/[id]`, `GET /api/visa/meta`,
`GET/POST /api/visa/requirements`,
`GET/PATCH/DELETE /api/visa/requirements/[id]`.

**Visa statuses** (9 total): `PREPARATION → SUBMITTED → BIOMETRICS →
INTERVIEW → PROCESSING → APPROVED → COMPLETED`, plus `REFUSED` and
`WITHDRAWN` as terminal decision points. `APPROVED` is intentionally
NOT terminal — it can transition to `COMPLETED` (the final "visa
received, travel booked" step). Terminal statuses (`REFUSED`,
`WITHDRAWN`, `COMPLETED`) cannot transition out.

**Database change** (run `npx prisma db push` after pulling): the
`VisaApplication` model was extended with:
- `visaType` (optional string) — e.g. "Student Visa (Tier 4)"
- `biometricsAt` (optional DateTime) — biometrics appointment date
- `interviewAt` (optional DateTime) — visa interview date
- `deletedAt` / `deletedBy` — soft-delete support for archive
- The `stage` default changed from `VISA_PREPARATION` to `PREPARATION`
  (the `VISA_` prefix was dropped for consistency with the new status
  set; existing records will need a data migration).
Non-destructive for existing fields.

**Visa Applications list** (DataTable):
- search across application number + student name
- filters: Stage, Country, Student, University
- sortable columns: stage, submittedAt, biometricsAt, interviewAt,
  decisionAt, createdAt, updatedAt
- row actions: View (detail page), Change Stage (dialog)
- columns: Application (link), Student, Country, University, Visa Type,
  Stage badge, Submitted date, Decision date

**Change Stage dialog**: shows the current stage + a dropdown of allowed
transitions (filtered by `canTransition`), plus an optional note. The
dialog blocks submission when the visa is in a terminal status. Every
status change is audit-logged + written to `ApplicationStatusHistory` +
syncs the linked application's `stageKey` + notifies the student.

**Visa Application detail page** (`/admin/visa/[id]`, tabbed):
- **Overview**: stat strip (stage, submitted, decision, document count),
  visa details card (stage, visa type, submission/biometrics/interview/
  decision dates, created/updated), application context card (application
  link, student link, student ID, email, phone, country, university link,
  course), and a notes card
- **Documents**: server-rendered table of all documents attached to this
  application (name, type, size, status badge, uploaded/reviewed/expires)
- **Timeline**: merged timeline of `ApplicationStatusHistory` entries
  (stage changes with from→to, note, actor name, timestamp) and audit
  log entries (action, old/new value, timestamp) — sorted newest first

**Visa Requirements** (country-specific configuration):
- full CRUD (create, edit, delete) via DataTable + FormDialog +
  ConfirmDialog
- fields: Country, Requirement name, Description, Required (boolean),
  Sort order, Status (ACTIVE/INACTIVE)
- country-scoped — admins configure the list of documents/steps students
  must submit for a visa application to each country
- edit/delete via the existing `/api/visa/requirements/[id]` endpoints

**Pure helpers** (`lib/constants/visa.ts`, unit-tested):
- `VISA_STATUSES`, `VISA_STATUS_LABELS` — canonical enums + labels
- `TERMINAL_VISA_STATUSES` — `["REFUSED", "WITHDRAWN", "COMPLETED"]`
  (APPROVED is intentionally not terminal)
- `POSITIVE_DECISION_STATUSES` — `["APPROVED", "COMPLETED"]`
- `NEGATIVE_DECISION_STATUSES` — `["REFUSED", "WITHDRAWN"]`
- `VISA_SORT_KEYS` — sort allow-list for the admin list
- `COMMON_VISA_TYPES` — dropdown suggestions for the visaType field
- `allowedTransitions(from)` — returns the set of statuses the visa can
  move to from the given current status; terminal statuses return []
- `canTransition(from, to)` — true if the transition is allowed
- `isDecisionStatus(status)` — true for APPROVED / REFUSED / WITHDRAWN
  (sets `decisionAt`)
- `isSubmissionStatus(status)` / `isBiometricsStatus(status)` /
  `isInterviewStatus(status)` — true for the corresponding date-setting
  statuses
- `buildAdminVisaWhere(filters)` — Prisma `where` fragment with
  deletedAt null + AND-combined search/stage/country/student/
  application/university filters

**Visa service** (`lib/services/visa.ts`):
- `changeStage(id, targetStage, note, actor)` — enforces transition
  rules via `canTransition`, sets the appropriate date field
  (submittedAt/biometricsAt/interviewAt/decisionAt) only when not
  already set (preserves the original "first time we hit this stage"
  timestamp), writes an `ApplicationStatusHistory` entry, syncs the
  linked application's `stageKey`, notifies the student, and audit-logs
  as `visa_application.stage_changed`.
- `update(id, input, actor)` — updates editable fields (visaType, dates,
  notes) with a structured old→new audit diff. Stage changes go through
  `changeStage` so they're audit-logged distinctly.
- `archive(id, actor)` — soft-deletes the visa application. Retains the
  record for audit trails.

**Validation** (`lib/validations/index.ts`):
- `visaApplicationCreateSchema` — requires `applicationId`; optional
  `visaType` (max 200 chars) + `notes` (max 5000 chars).
- `visaApplicationUpdateSchema` — all fields optional; dates are
  nullable coerced.
- `visaStageChangeSchema` — `stage` enum (all 9 statuses) + optional
  `note` (max 2000 chars).

**API improvements**:
- `GET /api/visa` — full filter set (search, stage, countryId, studentId,
  applicationId, universityId) + sorting via `sortFrom` allow-list +
  pagination. Uses `buildAdminVisaWhere`.
- `POST /api/visa` (new) — create a visa application record tied to an
  existing application. Validates the application exists + no duplicate
  visa record. Audit-logs as `visa_application.created`.
- `PATCH /api/visa` — stage change. Body: `{ id, stage, note? }`.
  Delegates to `visaService.changeStage` which enforces transition rules.
- `GET /api/visa/[id]` (new) — full detail: visa record, linked
  application (student, country, university, course), documents, and
  merged timeline (ApplicationStatusHistory + audit logs).
- `PATCH /api/visa/[id]` (new) — update editable fields. Delegates to
  `visaService.update`.
- `DELETE /api/visa/[id]` (new) — archive (soft delete). Delegates to
  `visaService.archive`.
- `GET /api/visa/meta` (new) — filter options (countries, students,
  universities, statuses) that have at least one visa application.

**Audit coverage added**: `visa_application.created`, 
`visa_application.stage_changed` (with old→new stage diff + note),
`visa_application.updated` (structured field diff),
`visa_application.archived`. Plus the existing
`visa_requirement.created/updated/deleted` from Module 06.

**Tests**: `tests/visa.test.ts` — 42 tests covering:
- Status + sort enum stability + labels
- Terminal/positive/negative decision status identification
- `canTransition` (forward, backward, WITHDRAWN from any non-terminal,
  terminal rejection, same-status rejection, unknown status rejection,
  APPROVED → COMPLETED allowed)
- `allowedTransitions` (empty for terminal, non-empty for non-terminal
  incl. APPROVED, excludes current status)
- `isDecisionStatus` / `isSubmissionStatus` / `isBiometricsStatus` /
  `isInterviewStatus` type checks
- `buildAdminVisaWhere` (deletedAt always present, stage/country/student/
  application/university filters, search OR clause, whitespace trimming,
  full AND-chain combination)
- `visaApplicationCreateSchema` (required applicationId, optional
  visaType/notes, length caps)
- `visaApplicationUpdateSchema` (empty accepted, partial updates,
  nullable dates, length caps)
- `visaStageChangeSchema` (required stage, all 9 statuses accepted,
  unknown rejected, optional note, length cap)

429 tests total via `npm run test` (15 files).

**Known limitations**: the `stage` default changed from `VISA_PREPARATION`
to `PREPARATION` — existing visa records with the old `VISA_PREPARATION`
value will need a data migration (or will fail validation on next stage
change). The `VISA_` prefix was dropped for consistency with the new
9-status set. The visa detail page's timeline merges
`ApplicationStatusHistory` + audit logs client-side — for very long
timelines (>50 history entries + >30 audit entries) older events are
truncated. The stage-change dialog uses `window.location.reload()` to
refresh the DataTable (a proper queryClient invalidation would be
cleaner — TODO).

## 42. Admin Task Management (v2)

**Routes**: `/admin/tasks` (list). APIs: `GET/POST /api/tasks`,
`GET/PATCH/DELETE /api/tasks/[id]`, `GET /api/tasks/stats`,
`GET /api/tasks/meta`.

**Task fields**: Title, Description, Student (optional), Application
(optional), Assigned Employee, Priority (LOW/MEDIUM/HIGH/URGENT),
Status (TODO/IN_PROGRESS/COMPLETED/CANCELLED), Due Date, Created By,
Completed At.

**Statuses**: `TODO → IN_PROGRESS → COMPLETED | CANCELLED`. Terminal
statuses (COMPLETED, CANCELLED) are excluded from the "overdue"
calculation.

**Priorities**: `LOW < MEDIUM < HIGH < URGENT` (weight 1-4 for sorting).

**5 Views** (toggle chips):
- **All**: no date filter
- **Today**: dueDate falls within today (UTC)
- **Upcoming**: dueDate is strictly after today
- **Overdue**: dueDate is in the past AND status is open (TODO or
  IN_PROGRESS)
- **Completed**: status is COMPLETED

**List features** (all server-side via the shared `DataTable`):
- search across title + description
- filters: Status, Priority, Employee (admin only — employees are
  auto-scoped to their own tasks)
- sortable columns: title, status, priority, dueDate, createdAt,
  updatedAt
- archived toggle to view soft-deleted tasks
- row actions: Edit, Assign, Complete, Cancel, Archive
- overdue highlighting (red text + warning icon on past-due open tasks)

**Row actions** (all RBAC'd server-side via `tasks.manage`):
- **Edit**: opens FormDialog with title/description/student/priority/
  status/dueDate fields
- **Assign**: opens FormDialog with employee dropdown — PATCHes with
  `assignedToId` which triggers the assign path (audit-logged as
  `task.assigned`, new assignee notified)
- **Complete**: confirm dialog → sets status to COMPLETED, sets
  `completedAt` to now, notifies the task creator
- **Cancel**: immediate action → sets status to CANCELLED, notifies the
  assignee
- **Archive**: confirm dialog → soft-deletes (sets deletedAt + deletedBy)

**Overdue detection**: `isOverdue(dueDate, status, now)` returns true
when the due date is in the past AND the status is not terminal
(COMPLETED or CANCELLED). Used by the UI for red highlighting and by the
"Overdue" view filter.

**Notifications** for important task events:
- `TASK_ASSIGNED`: new task assigned or reassigned → notifies the new
  assignee
- `TASK_COMPLETED`: task marked as completed → notifies the task creator
  (if different from the actor)
- `TASK_CANCELLED`: task cancelled → notifies the assignee

**Employee task performance** (`GET /api/tasks/stats`):
Returns per-employee task counts (pending, overdue, completed, cancelled,
total) for the admin dashboard's "Employee Task Performance" widget.
Aggregates all non-archived tasks grouped by `assignedToId`, sorted by
overdue desc then pending desc — employees who need attention surface
first. Also returns overall team totals.

**Pure helpers** (`lib/constants/tasks.ts`, unit-tested):
- `TASK_STATUSES`, `TASK_STATUS_LABELS`, `OPEN_TASK_STATUSES`,
  `TERMINAL_TASK_STATUSES`
- `TASK_PRIORITIES`, `TASK_PRIORITY_LABELS`, `TASK_PRIORITY_WEIGHT`
- `TASK_VIEWS`, `TASK_VIEW_LABELS`
- `TASK_SORT_KEYS`
- `isOverdue(dueDate, status, now)` — past due + non-terminal status
- `isDueToday(dueDate, now)` — due date within today (UTC)
- `isUpcoming(dueDate, now)` — due date strictly after today
- `buildTaskViewWhere(view, now)` — Prisma where fragment per view
- `buildAdminTaskWhere(filters)` — full where with archived toggle +
  search/status/priority/employee/student/application filters + view
- `computeTaskStats(tasks, now)` — pending/overdue/completed/cancelled/
  total counts (reused by the stats endpoint and the existing
  `employee-insights.ts` helper)

**Validation** (`lib/validations/index.ts`):
- `taskSchema` — create schema. Requires title + assignedToId; optional
  description (max 5000), studentId, applicationId, dueDate; priority
  defaults to MEDIUM.
- `taskUpdateSchema` — partial update schema. Does NOT include
  `assignedToId` (that goes through the assign path in the PATCH
  handler). Status enum validated. DueDate is nullable.
- `taskAssignSchema` — just `assignedToId` (min 1 char).

**API improvements**:
- `GET /api/tasks` — full filter set (search, status, priority,
  assignedToId, studentId, applicationId, view, archived toggle) +
  sorting + pagination. Employees auto-scoped to their own tasks.
- `POST /api/tasks` — validates the assignee exists + is active,
  notifies the assignee, audit-logs creation.
- `GET /api/tasks/[id]` (new) — single task with student + application
  joins. Employees can only access their own tasks.
- `PATCH /api/tasks/[id]` — dual-purpose handler: when `assignedToId`
  is in the body, runs the assign path (audit + notify); otherwise runs
  the general update path (structured audit diff + status-change
  notifications). `completedAt` set automatically when status becomes
  COMPLETED.
- `DELETE /api/tasks/[id]` — archive (soft delete). Retains data for
  audit trails.
- `GET /api/tasks/stats` (new) — per-employee task performance for the
  admin dashboard.
- `GET /api/tasks/meta` (new) — filter options (employees, students,
  statuses, priorities, views).

**Database change** (run `npx prisma db push` after pulling): added
`deletedAt` and `deletedBy` to the `Task` model for archive support,
plus `@@index([priority])`. Non-destructive — existing tasks continue
to work (the new fields default to null).

**Audit coverage added**: `task.created` (now with structured newValue),
`task.updated` (structured old→new diff), `task.status_changed`
(distinct event), `task.assigned` (old→new assignee diff),
`task.archived`.

**Tests**: `tests/tasks.test.ts` — 59 tests covering:
- Status/priority/view/sort enum stability + labels + weights
- `isOverdue` (past + open, past + terminal, future, null, ISO string,
  invalid date)
- `isDueToday` (within today, different day, null, ISO string)
- `isUpcoming` (after today, today, past, null)
- `buildTaskViewWhere` (all=null, today=range, upcoming=gt, overdue=lt
  + open statuses, completed=status filter)
- `buildAdminTaskWhere` (archived toggle, status/priority/employee/
  student/application filters, search OR clause, whitespace trimming,
  view filter combination, 'all' no-op)
- `computeTaskStats` (pending/overdue/completed/cancelled/total,
  completed-not-overdue, empty list, null due date)
- `taskSchema` (required fields, default priority, dueDate acceptance,
  invalid priority, optional studentId/applicationId, description cap)
- `taskUpdateSchema` (empty accepted, partial updates, nullable
  dueDate, invalid status/priority rejection, assignedToId not in
  schema)
- `taskAssignSchema` (required, empty rejected)

488 tests total via `npm run test` (16 files).

**Known limitations**: the assign action goes through the same PATCH
endpoint as the general update (the handler inspects the body for
`assignedToId` to route to the assign path) — a dedicated
`/api/tasks/[id]/assign` endpoint would be cleaner but the current
approach avoids a new route file. The "Cancel" action is immediate (no
confirm dialog) — this is intentional for speed but could be changed to
a confirm dialog if misclicks become an issue. The task performance
stats endpoint (`/api/tasks/stats`) is not yet wired into the admin
dashboard UI — it's ready for the dashboard widget to consume.

## 43. Admin Finance Management (v2)

**Routes**: `/admin/payments` (list), `/admin/invoices` (list),
`/admin/invoices/[id]` (detail + printable view). APIs: `GET/POST
/api/payments`, `GET/PATCH/DELETE /api/payments/[id]`,
`POST /api/payments/[id]/refund`, `GET/POST /api/invoices`,
`GET/PATCH/DELETE /api/invoices/[id]`.

**Payments**: Amount, Currency, Student, Application (optional),
Invoice (optional), Payment Method (CASH/BANK_TRANSFER/BKASH/NAGAD/
CARD/OTHER), Transaction Reference, Payment Date, Status (PENDING/PAID/
PARTIAL/REFUNDED/CANCELLED), Created By.

**Invoices**: Invoice Number (auto-generated INV-YYYY-NNNNN), Student,
Application (optional), Items (JSON array of {description, quantity,
unitPrice}), Subtotal, Discount, Total, Paid Amount, Due Amount, Status
(DRAFT/ISSUED/PARTIAL/PAID/OVERDUE/CANCELLED), Issue Date, Due Date.

**Financial rules** (enforced server-side in `invoiceService`):
- **Totals are always computed server-side** via `computeInvoiceTotals`
  — client-sent totals are never trusted.
- **Payments cannot exceed the invoice's due amount** — validated at
  `recordPayment` and `updatePayment` time.
- **Financial records are never hard-deleted** — only soft-deleted
  (archived) for audit trails. The `DELETE` endpoints set `deletedAt`
  + `deletedBy` rather than removing the record.
- **Refunds reverse the payment** (status → REFUNDED) and adjust the
  linked invoice's paid/due/status accordingly. Refunded payments cannot
  be edited.
- **Overpayment prevention**: `recordPayment` checks `amount > dueAmount`
  and throws a 400 BAD_REQUEST.
- **Invoice recalculation**: when invoice items or discount are edited,
  the subtotal/total/paidAmount/dueAmount/status are recomputed
  server-side, keeping paid/due consistent with the new total.

**Payments list** (DataTable):
- search by transaction reference
- filters: Status, Method, Student, date range (paymentFrom/paymentTo)
- sortable columns: amount, paymentMethod, paymentDate, status, createdAt
- row actions: Edit, Refund, Archive
- record payment dialog with student/amount/method/reference/date

**Invoices list** (DataTable):
- search by invoice number
- filters: Status, Student
- sortable columns: invoiceNumber, total, paidAmount, dueAmount, status,
  issueDate, dueDate, createdAt
- row actions: View (detail page), Print (opens printable view in new tab),
  Archive
- create invoice dialog with student/items/discount/dueDate

**Invoice detail page** (`/admin/invoices/[id]`):
- Normal view: header with print button + status badge, payment progress
  bar (visual % paid), line items table, summary card (subtotal/discount/
  total/paid/due + issue/due dates + application link), payments table
- **Printable view** (`?print=1`): clean, print-friendly layout with
  "Bill To" section, line items table, totals summary, status badge, and
  a "Print Invoice" button that triggers `window.print()`. Opened in a
  new tab so the admin can print without leaving the list.

**Refund workflow**:
- Refund dialog shows the payment amount + student name + warning that the
  refund will reverse the payment and adjust the linked invoice.
- Optional reason field (max 2000 chars) — audit-logged.
- The refund sets payment status to REFUNDED, adjusts the invoice's
  paidAmount (subtracts the payment amount) and dueAmount (adds it back),
  and recomputes the invoice status (ISSUED if paidAmount reaches 0,
  PARTIAL otherwise).
- Refunded payments cannot be edited (409 CONFLICT).

**Audit coverage added**: `invoice.created` (existing), `invoice.updated`
(structured old→new diff), `invoice.archived`, `payment.recorded`
(existing, now with invoiceId), `payment.updated` (structured diff),
`payment.refunded` (with reason + old status), `payment.archived`.

**Pure helpers** (`lib/constants/finance.ts`, unit-tested):
- `PAYMENT_STATUSES`, `PAYMENT_STATUS_LABELS`, `PAYMENT_METHODS`,
  `PAYMENT_METHOD_LABELS`
- `INVOICE_STATUSES`, `INVOICE_STATUS_LABELS`
- `PAYMENT_SORT_KEYS`, `INVOICE_SORT_KEYS`
- `buildAdminPaymentWhere(filters)` — Prisma `where` with deletedAt +
  search/status/student/application/invoice/method/date-range filters
- `buildAdminInvoiceWhere(filters)` — Prisma `where` with deletedAt +
  search/status/student/application/date-range filters
- `formatMoney(amount, currency)` — `Intl.NumberFormat` with safe fallback
- `paymentProgress(invoice)` — returns 0-100 percentage paid

**Finance service** (`lib/services/finance.ts`):
- `computeInvoiceTotals(items, discount)` — pure server-side math (clamps
  discount to 0-subtotal, rejects negative discounts)
- `create(input, actor)` — generates invoice number, computes totals,
  audit-logs creation
- `update(id, input, actor)` — recomputes totals when items/discount
  change, recalculates paid/due/status, audit-logs update
- `archive(id, actor)` — soft-deletes the invoice
- `recordPayment(input, actor)` — validates against due amount, updates
  linked invoice's paid/due/status, audit-logs recording
- `updatePayment(id, input, actor)` — validates against adjusted due,
  recalculates invoice totals, audit-logs update
- `refund(id, reason, actor)` — reverses payment, adjusts invoice,
  audit-logs refund with reason
- `archivePayment(id, actor)` — soft-deletes the payment

**Validation**:
- `paymentSchema` — create: studentId + amount + paymentMethod required;
  amount must be positive; currency defaults to BDT
- `paymentUpdateSchema` — partial: amount/method/reference/date;
  status NOT included (goes through refund)
- `paymentRefundSchema` — optional reason (max 2000 chars)
- `invoiceSchema` — create: studentId + items (min 1); discount defaults 0;
  items require positive quantity + non-negative unitPrice
- `invoiceUpdateSchema` — partial: items/discount/dates/status; empty
  items array rejected

**Tests**: `tests/finance.test.ts` — 61 tests covering payment/invoice
enum stability + labels, sort allow-lists, `buildAdminPaymentWhere`
(all filters + search + date range + AND-chain), `buildAdminInvoiceWhere`
(all filters + search + date range), `formatMoney` (nullish/currency/
fallback), `paymentProgress` (0/25/33/50/100/overpayment/zero-total),
`computeInvoiceTotals` (subtotal/discount/clamp/negative/empty),
`paymentSchema` (required fields, defaults, non-positive amount, invalid
method, optional fields), `paymentUpdateSchema` (partial, non-positive
rejection, nullable date), `paymentRefundSchema` (optional reason,
length cap), `invoiceSchema` (required fields, default discount, negative
discount, zero quantity, negative unitPrice), `invoiceUpdateSchema`
(partial, empty items rejected, status enum, invalid status).

549 tests total via `npm run test` (17 files).

**Known limitations**: the invoice create dialog only supports a single
line item (the FormDialog doesn't have a dynamic-items-adder yet —
multi-item invoices require a future "items editor" component). The
printable invoice view uses `window.print()` which relies on the
browser's print dialog — server-side PDF generation is a TODO. The
existing `tests/invoice-totals.test.ts` file still runs alongside the
new `tests/finance.test.ts` (the `computeInvoiceTotals` tests are
duplicated — the old file can be removed once confirmed redundant).
