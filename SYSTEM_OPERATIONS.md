# SVMS System Operations

Production-grade system administration for the Euroscope Student Visa Management System.

This module adds a complete operational layer to the Admin Panel, covering backups,
security, SEO, analytics, health, maintenance, and disaster recovery — without
duplicating the existing audit log, settings, or notification infrastructure.

## Module Map

| Route | Purpose |
|-------|---------|
| `/admin/system` | Operational dashboard with real metrics from across the system. |
| `/admin/system/backups` | Create, verify, download, restore, and delete MongoDB backups. |
| `/admin/system/security` | Security audit (auth, RBAC, headers, rate limits, audit logging). |
| `/admin/system/seo` | Global SEO config, robots.txt builder, technical audit. |
| `/admin/system/analytics` | GA4 / GTM / Meta Pixel config + consent + test events. |
| `/admin/system/health` | Live health checks for database, auth, storage, email, cron, etc. |
| `/admin/system/configuration` | Environment variable health + non-secret config editor. |
| `/admin/system/logs` | Paginated, filterable SecurityEvent viewer. |
| `/admin/system/maintenance` | Enable/disable maintenance mode with audit trail. |
| `/admin/system/jobs` | Vercel Cron job status + manual triggers. |
| `/admin/system/sessions` | Active session viewer (JWT strategy — revocation via user suspension). |
| `/admin/system/audit` | Reuses the existing AuditAdmin component. |
| `/admin/system/disaster-recovery` | RPO/RTO, restore procedure, emergency steps, checklist. |
| `/admin/system/security/events` | Dedicated SecurityEvent viewer with acknowledge/resolve actions. |

## Architecture

### Reused infrastructure

- **AuditLog** — every sensitive operation is audited via the existing
  `auditLog.record()` service. New audit actions: `backup.created`,
  `backup.deleted`, `backup.restored`, `backup.verified`,
  `backup.downloaded`, `maintenance.enabled`, `maintenance.disabled`,
  `seo_setting.updated`, `analytics_setting.updated`,
  `configuration.changed`, `security_event.resolved`.
- **SystemSetting** — JSON-valued key-value store backs all
  non-secret configuration. No duplicate settings tables.
- **Notification** — system events can be surfaced via the existing
  notification infrastructure (not duplicated).
- **StoredFile** — backups are stored as `kind="system-backup"` rows
  in MongoDB (serverless-compatible).

### New Prisma models

- **BackupRecord** — one row per backup operation (status, size,
  checksum, encryption metadata, restore history).
- **BackupSchedule** — frequency + retention for scheduled backups.
- **SystemHealthCheck** — historical health check results (for trends).
- **SecurityEvent** — security incidents (failed logins, suspicious
  requests, config changes).
- **MaintenanceWindow** — active maintenance window with allow-admin flag.

### New permissions

All ADMIN-only:
`backup.create`, `backup.read`, `backup.restore`, `backup.delete`,
`security.read`, `security.manage`, `system.read`, `system.manage`,
`system.health.read`, `system.logs.read`, `system.config.read`,
`system.config.manage`, `seo.read`, `seo.manage`, `analytics.read`,
`analytics.manage`, `maintenance.read`, `maintenance.manage`.

### Backup architecture

- **Format**: JSON-line stream (one JSON object per document per line).
- **Encryption**: AES-256-GCM. Key derived from `AUTH_SECRET` via scrypt
  with a per-backup random salt. Salt + IV + auth tag stored on
  BackupRecord; key NEVER persisted.
- **Sensitive data stripping**: `passwordHash`, `data` (binary),
  any field matching `/secret|token|password|apiKey/i` is dropped
  before serialization.
- **Verification**: decrypts archive, recomputes SHA-256, parses every
  JSON line, validates each document has an `id`. Backups are only
  marked `VERIFIED` when every check passes.
- **Retention**: 7 daily, 4 weekly, 12 monthly. The system refuses
  to delete the only known valid backup.
- **Restore**: creates a safety backup first, requires the phrase
  "I UNDERSTAND THE RISK", supports selective restore (per-model)
  and skip-existing (idempotent).

### Cron jobs (vercel.json)

```json
{
  "crons": [
    { "path": "/api/admin/system/backups/cron?job=daily-backup",  "schedule": "0 2 * * *" },
    { "path": "/api/admin/system/backups/cron?job=weekly-backup", "schedule": "0 3 * * 1" },
    { "path": "/api/admin/system/backups/cron?job=monthly-backup","schedule": "0 4 1 * *" },
    { "path": "/api/admin/system/jobs/cron?job=cleanup-deleted-backups", "schedule": "0 5 * * *" },
    { "path": "/api/admin/system/health/cron?job=health-check",   "schedule": "*/15 * * * *" }
  ]
}
```

Each cron endpoint requires `CRON_SECRET` env var (sent by Vercel
automatically as Bearer token, also accepted via `?token=` for local dev).

## Analytics & Tracking

- **Providers**: GA4 (`G-XXXXXXXX`), GTM (`GTM-XXXXXXX`), Meta Pixel
  (15-16 digit numeric ID). All IDs validated before saving.
- **Consent**: necessary (always on), analytics, marketing. Marketing
  scripts only load after explicit user opt-in.
- **trackEvent()**: single client-side entry point. Strips sensitive
  fields (email, phone, passport, applicationId, paymentId, etc.)
  before dispatching to any provider.
- **Cookie banner**: rendered by `<AnalyticsProviders />` in the root
  layout. Stores consent in `localStorage["svms-consent"]`.

## Security model

- All `/api/admin/system/*` endpoints require authentication + the
  appropriate permission via `guard()`.
- Zod validation on every mutating endpoint.
- Rate-limited: backup creation is capped at 5/hour per admin.
- Audit logged with IP + user agent at every sensitive action.
- Secrets are NEVER returned in API responses — the env var health
  checker only reports `Configured: true/false`.

## Maintenance mode

When enabled via `/admin/system/maintenance`:
- A `MaintenanceWindow` row is created.
- Public users see `/maintenance` (server-rendered with the admin's message).
- Admins can still access `/admin` when `allowAdminAccess=true` (default).
- Mutating API routes can call `requireNotMaintenance(userRole)` to
  return 503 with `{ error: { code: "MAINTENANCE_MODE" } }`.
- Every enable/disable is audited.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | MongoDB connection string |
| `AUTH_SECRET` | Yes | Signs JWT sessions + derives backup encryption key |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical URL for SEO + cookies |
| `CRON_SECRET` | Production | Protects cron endpoints |
| `EMAIL_SERVER_*` | Optional | SMTP for transactional email |
| `BACKUP_STORAGE_PROVIDER` | Optional | `local` (default) / `s3` / `r2` / `vercel-blob` |
| `BACKUP_BUCKET`, `BACKUP_REGION`, `BACKUP_ENDPOINT` | Optional | External storage config |
| `BACKUP_ACCESS_KEY`, `BACKUP_SECRET_KEY` | Optional | External storage credentials |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Optional | GA4 (public ID, safe to expose) |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Optional | GTM container |
| `NEXT_PUBLIC_META_PIXEL_ID` | Optional | Meta Pixel ID |

## Disaster recovery

See `/admin/system/disaster-recovery` for the full documentation
(RPO, RTO, restore procedure, emergency checklist).

Quick summary:
- **RPO**: 24 hours (between daily backups)
- **RTO**: 2 hours (restore + verify)
- **Safety**: every restore creates a pre-restore safety backup
- **Refusal**: the system refuses to delete the only known valid backup

## Tests

```bash
bun run test system-config       # config store, defaults, secret rejection
bun run test system-analytics    # GA4/GTM/Meta ID validation
bun run test system-permissions # RBAC for all new permissions
bun run test system-seo         # robots.txt builder
bun run test system-env         # env var health checks
bun run test system-security    # secret protection + RBAC + audit entity types
```

All tests are pure (no MongoDB required) — they mock the Prisma client
and verify the service-layer logic.
