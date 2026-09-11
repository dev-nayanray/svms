# SVMS Security Policy

## Authentication

- Credentials-based login via Auth.js (NextAuth v5) with **JWT sessions** (httpOnly cookies).
- Passwords are hashed with **bcrypt** (cost 10). Plaintext passwords are never stored or logged.
- Inactive/suspended/pending users cannot sign in (enforced in the `authorize` callback).
- Login attempts update `lastLoginAt` and registration/login are audit-logged.

## Authorization (RBAC)

- Centralized permission map in `lib/permissions/index.ts` (`hasPermission`, `assertPermission`).
- API routes enforce permissions server-side via `guard()` / `requirePermission()`.
- Server components enforce roles via `RoleLayout` (redirects to `/403`).
- Business-rule isolation is enforced in services (`applicationService.assertCanAccess`,
  document upload ownership checks):
  - Students can only read/write **their own** data.
  - Employees can only manage cases where they are the assigned counselor.
  - Client-side checks are convenience only — **never trusted**.

## Validation

- All API inputs are validated with **Zod** (`lib/validations`) on the server.
- Consistent error envelope (`lib/api.ts`); stack traces are never exposed in production.

## File Uploads

- Server-side MIME allow-list (PDF/JPEG/PNG/WebP) and 10MB size limit
  (`documentService.validateFileMeta`). Client validation is never relied upon.
- Document metadata and review decisions are audit-logged.
- TODO: storage is currently a URL field — wire to private object storage (S3/MinIO) with
  short-lived signed download URLs before production use.

## Data Protection

- Soft delete (`deletedAt`/`deletedBy`) for students, applications, documents, invoices,
  payments, universities, courses, leads — financial/audit records are never hard-deleted
  through the UI.
- Sensitive env vars (`DATABASE_URL`, `AUTH_SECRET`, storage/email credentials) are
  server-only; `.env` is git-ignored and must never be committed.

## Audit Logging

Critical actions recorded in `AuditLog` with actor, entity, old/new values, IP and user agent
where available: user registration, student create/soft-delete, lead conversion, application
create/stage change, document upload/approve/reject, invoice create, payment recording,
university create.

## Session & Transport

- Cookies are `httpOnly` + `SameSite=Lax`; use HTTPS in production (`__Secure-` cookie prefix
  is applied automatically by Auth.js on secure origins).
- Middleware redirects unauthenticated users away from protected route prefixes.

## Reporting Vulnerabilities

Contact the maintainer privately. Do not open public issues for security problems.
