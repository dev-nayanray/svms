# SVMS Security Policy

## Authentication

- Credentials-based login via Auth.js (NextAuth v5) with **JWT sessions** (httpOnly cookies).
- Passwords are hashed with **bcrypt** (cost 10). Plaintext passwords are never stored or logged.
- Inactive/suspended/pending users cannot sign in (enforced in the `authorize` callback).
- Login attempts update `lastLoginAt` and registration/login are audit-logged.
- **No hardcoded default passwords** — student creation requires an explicit password
  (admin student-create UI) or generates a random 12-char temp password (lead conversion).
- **Rate limiting on the login endpoint** (5 attempts / IP / min, +1 token / min refill)
  via in-memory token bucket (`lib/security/rate-limit.ts`) wrapped around the NextAuth
  credential callback handler.

## Authorization (RBAC)

- Centralized permission map in `lib/permissions/index.ts` (`hasPermission`, `assertPermission`).
- API routes enforce permissions server-side via `guard()` / `requirePermission()`.
- Server components enforce roles via `RoleLayout` (redirects to `/403`).
- Business-rule isolation is enforced in services (`applicationService.assertCanAccess`,
  document upload ownership checks):
  - Students can only read/write **their own** data.
  - Employees can only manage cases where they are the assigned counselor.
  - Client-side checks are convenience only — **never trusted**.
- **Defense-in-depth for the Student Panel**: the edge proxy redirects role mismatches
  to the role's home; the student layout re-verifies the STUDENT role server-side;
  every `/api/student/**` route calls `studentApiGuard()` which resolves `studentId`
  from the session and rejects non-STUDENT roles with 403.

## IDOR Protection (Student Panel)

- Every `[id]` route under `/api/student/**` resolves `studentId` from the session,
  NEVER from the URL or body. Prisma queries are scoped by `where: { id, studentId }`.
- Foreign IDs (resources owned by another student) return **404 NOT_FOUND**, never 403 —
  this prevents an attacker from confirming the existence of another student's resource.
- The same pattern is applied to conversation, message, appointment, support, task,
  notification, invoice, payment, visa, application, and document routes.
- Service-layer methods re-verify ownership before writes (double-check pattern).

## Validation

- All API inputs are validated with **Zod** (`lib/validations`) on the server.
- Consistent error envelope (`lib/api.ts`); stack traces are never exposed in production.
- PATCH endpoints use allow-lists (e.g. profile PATCH rejects `studentId`, `userId`,
  `branchId`, `assignedEmployeeId`, `status`, `role`, `email` with 422).
- Tasks PATCH only allows the `status` field (rejects all others with 422).
- File uploads validate MIME against an allow-list (not extension-inferred).

## File Uploads & Document Security

- Server-side MIME allow-list (PDF/JPEG/PNG/WebP) and 10MB size limit
  (`documentService.validateFileMeta`). Client validation is never relied upon.
- Files are written to **private storage** under `<cwd>/private-uploads/student-docs/`,
  NEVER under `/public/`. They are not directly accessible via any URL.
- On-disk filenames are sha-256 hashes + timestamps — no PII, no collisions, no overwrite
  attacks. The original filename (which may contain PII or special chars) is never used on disk.
- The only way to read a file is through `/api/student/documents/[id]/download`, which:
  - Verifies ownership server-side (`studentDocumentService.resolveForDownload`)
  - Sanitizes the filename in `Content-Disposition` (no CRLF injection)
  - Sets `Cache-Control: no-store, no-cache, must-revalidate, private`
  - Sets `X-Frame-Options: DENY` (defense in depth against clickjacking)
  - Audit-logs every download (best-effort)
- Document metadata and review decisions are audit-logged.
- Version history: when a student replaces a document, the OLD row is preserved with its
  status intact (APPROVED stays APPROVED). A NEW row is created with `replacesId` pointing
  back. The list endpoint returns only "current" rows (no `replacedBy`).

## Data Protection

- Soft delete (`deletedAt`/`deletedBy`) for students, applications, documents, invoices,
  payments, universities, courses, leads — financial/audit records are never hard-deleted
  through the UI.
- Sensitive env vars (`DATABASE_URL`, `AUTH_SECRET`, storage/email credentials) are
  server-only; `.env` is git-ignored and must never be committed.
- **Sensitive-field masking** in API responses:
  - `passwordHash`, `role`, `permissions`, `assignedEmployeeId`, `branchId` — never selected
    in any student-facing response.
  - `notes` on `VisaApplication` — omitted from the student-safe view (admin-only).
  - `reviewNote` on `Document` — only returned when status is `REJECTED` (so the student
    understands what to fix). For all other statuses, internal reviewer commentary is hidden.
  - `transactionReference` on `Payment` — masked for `PENDING` and `CANCELLED` payments.
  - `Internal` notes (visibility=`INTERNAL`) — filtered at the Prisma `include` level.

## Audit Logging

Critical actions are recorded in `AuditLog` with actor, entity, old/new values, **IP address**,
and **user agent**:

| Action                                  | Audit event                         |
| --------------------------------------- | ----------------------------------- |
| User registration                        | `user.registered`                  |
| Password change                         | `student.password_changed`         |
| Profile photo upload / removal          | `student_profile.photo_changed` / `.photo_removed` |
| Profile contact-info change             | `student_profile.<field>_changed`  |
| Academic record create/update/delete   | `academic_record.{created,updated,deleted}` |
| English proficiency create/update/delete | `english_proficiency.{created,updated,deleted}` |
| Document upload / replace / download   | `student_document.{uploaded,replaced,downloaded}` |
| Task status change / complete          | `task.status_changed`              |
| Appointment confirm / cancel            | `appointment.{confirmed,cancelled}` |
| Support ticket create                   | `support_request.created`           |
| Settings update                         | `student_settings.updated`          |
| Favorite toggle                         | `university.{favorited,unfavorited}` |
| Counseling request                      | `counseling_request.created`        |
| Message sent                            | `student_message.sent`             |
| Notification marked read / all read    | `notification.marked_read` / `marked_all_read` |
| Application view (sensitive stages)    | `student_application.viewed`        |

The audit log captures `ipAddress` (from `x-forwarded-for` left-most hop, falling back to
`x-real-ip`) and `userAgent` via the `auditLog.fromRequest(req)` helper. Audit-write failures
are caught and logged server-side (`console.error`) — they never break the business operation.

## Rate Limiting

A minimal in-memory token-bucket rate limiter (`lib/security/rate-limit.ts`) protects the
most sensitive endpoints against abuse:

| Endpoint                                            | Capacity | Refill      |
| -------------------------------------------------- | -------- | ----------- |
| `POST /api/auth/callback/credentials` (login)       | 5        | +1 / 60s    |
| `POST /api/student/settings/password`               | 5        | +1 / 60s    |
| `POST /api/auth/register`                          | 5        | +1 / 60s    |
| `POST /api/student/documents` (upload)              | 20       | +1 / 3s     |
| `POST /api/student/documents/[id]/replace`          | 20       | +1 / 3s     |
| `GET /api/student/documents/[id]/download`          | 60       | +1 / sec    |
| `POST /api/student/messages/[id]/messages`          | 30       | +1 / 2s     |
| `POST /api/student/support`                         | 5        | +1 / 60s    |
| `POST /api/student/counseling-requests`             | 10       | +1 / 30s    |

The limiter is per-IP (left-most `x-forwarded-for` hop). When exceeded, the response is
`429 TOO_MANY_REQUESTS` with `Retry-After` and `X-RateLimit-Remaining` headers.

**Multi-instance caveat**: this in-memory limiter only works for single-instance deployments
(one Node.js process). For serverless / autoscaling / multi-replica deployments, replace
`lib/security/rate-limit.ts` with a Redis-backed implementation (the `checkRateLimit`
interface is the same — only the storage layer changes).

## Session & Transport

- Cookies are `httpOnly` + `SameSite=Lax`; use HTTPS in production (`__Secure-` cookie prefix
  is applied automatically by Auth.js on secure origins).
- Middleware redirects unauthenticated users away from protected route prefixes.
- JWT re-validates against the DB every 5 minutes — if the user has been suspended,
  soft-deleted, or had their role changed, the token is invalidated (`role: "INVALID"`).

## Service Worker Security

The service worker (`public/sw.js`) is configured for defense in depth:

- NEVER caches `/api/*` routes (no sensitive data in cache)
- NEVER caches `/login` or auth-related routes
- NEVER caches non-GET requests (POST/PUT/DELETE)
- Static assets: cache-first (immutable)
- Navigation requests: network-first with offline fallback to `/offline`
- Update strategy: `skipWaiting()` + `clients.claim()` (instant updates)
- Old caches purged on activate (no stale data after deploy)

## Reporting Vulnerabilities

Contact the maintainer privately. Do not open public issues for security problems.
