# Backup & Recovery Guide

This document describes the backup architecture, restore procedure, and
disaster recovery plan for the Euroscope SVMS.

> **Live, interactive version**: `/admin/system/disaster-recovery`
> in the admin panel.

## Backup strategy

### What is backed up

- **Full backup** (`type=FULL`): all supported Prisma models (users,
  students, applications, documents metadata, payments, invoices,
  appointments, tasks, messages, notifications, universities, courses,
  branches, settings, audit logs).
- **Selective backup** (`type=SELECTIVE`): admin selects one or more
  module scopes (Users, Students, Leads, Applications, etc.).
- **Config backup** (`type=CONFIG`): only `SiteSetting` + `SystemSetting`
  rows (configuration data only).

### What is NOT backed up

- `User.passwordHash` — stripped to prevent credential leakage.
- `StoredFile.data` bytes — only metadata (size, mime, hash) is backed up.
  For full disaster recovery of binary files (student documents, profile
  photos), use MongoDB Atlas's native snapshot feature.
- Any field matching `/secret|token|password|apiKey/i` is stripped.

### Format

JSON-line stream (`.jsonl`): one JSON object per document per line.

```json
{"_model":"User","_doc":{"id":"...","name":"Alice","email":"alice@example.com","roleName":"ADMIN","deletedAt":null}}
{"_model":"User","_doc":{"id":"...","name":"Bob","email":"bob@example.com","roleName":"STUDENT","deletedAt":null}}
```

This format is:
- **Human-readable** — admins can grep / inspect the archive.
- **Streamable** — large archives can be processed line-by-line.
- **Resilient to partial corruption** — a single bad line does not
  invalidate the rest of the archive.

### Encryption

AES-256-GCM with a key derived from `AUTH_SECRET` via scrypt:

```
salt = random(16 bytes)
key  = scrypt(AUTH_SECRET, salt, 32 bytes)
iv   = random(12 bytes)
ciphertext, tag = AES-256-GCM-encrypt(plaintext, key, iv)
```

The salt + IV + auth tag are stored on the `BackupRecord` (in
`verificationNotes` as JSON). The encryption key is NEVER persisted —
anyone with `AUTH_SECRET` can derive it.

**Threat model**: this is the same threat model as the database itself.
Anyone with database access can already read all data; requiring
`AUTH_SECRET` to decrypt backups prevents accidental exposure if a
backup archive is leaked outside the database.

### Verification

After a backup completes, admins can click **Verify** to run the
verification routine:

1. The archive's `StoredFile` row exists.
2. The archive can be decrypted with `AUTH_SECRET`.
3. The SHA-256 checksum matches.
4. Every line parses as valid JSON.
5. Every document has an `id` field.
6. The document count matches what was recorded at backup time.

A backup is marked `VERIFIED` only when every check passes. The verification
result (per-check status) is stored as JSON in `verificationNotes`.

### Retention

| Frequency | Retention |
|-----------|-----------|
| Daily | 7 backups |
| Weekly | 4 backups |
| Monthly | 12 backups |
| Max total | 50 backups |

The system refuses to delete the only known valid backup — you must
create another backup first.

A daily cron job purges soft-deleted backups older than 24 hours.

## Restore procedure

> **HIGH-RISK OPERATION**. Requires:
> 1. `backup.restore` permission (admin only)
> 2. The confirmation phrase: `I UNDERSTAND THE RISK`
> 3. If the backup is unverified, explicit acknowledgment of risk

### Steps

1. Navigate to **Admin → System → Backup & Restore**.
2. Identify the backup to restore. Prefer `VERIFIED` backups.
3. Click the **Verify** button if not already verified. Wait for the
   verification report.
4. Click the **Restore** button. A dialog appears with full backup details.
5. **The system automatically creates a safety backup** before any
   restore operation. If this fails, the restore proceeds but a warning
   is logged.
6. Type the confirmation phrase `I UNDERSTAND THE RISK`.
7. If the backup is unverified, check the "acknowledge risk" checkbox
   (NOT recommended).
8. Click **Restore Now**. The restore runs synchronously and returns a
   per-model summary (inserted / skipped / errors).
9. After restore, refresh affected pages and verify data integrity. If
   anything looks wrong, restore from the safety backup created in step 5.

### Restore ordering

MongoDB doesn't enforce FK constraints, but the restore still processes
models in dependency order to avoid orphaned references:

```
Role → Permission → Branch → User → Employee → Student →
AcademicRecord → EnglishProficiency → StudentPreference →
Lead → CounselingRequest → Country → University → Course → Intake →
ApplicationStage → Application → ApplicationStatusHistory →
UniversityFavorite → DocumentRequirement → Document →
VisaRequirement → VisaApplication → Task → Appointment → Note →
Conversation → Message → Notification → Invoice → Payment →
SiteSetting → SystemSetting → AuditLog → BackupRecord → ...
```

If a referenced parent is missing, the child document is restored
anyway (MongoDB doesn't enforce). Application-level logic should
handle the orphan case.

### Selective restore

The `onlyModels` parameter restricts restore to specific models. Useful
for "restore just the Settings" without touching student data.

## RPO / RTO

| Metric | Target | Notes |
|--------|--------|-------|
| RPO | 24 hours | Worst case data loss = 1 day (between daily backups). Tighten by increasing backup frequency. |
| RTO | 2 hours | Restore + verify application health. |

## Emergency procedure

If the production database is down or corrupted:

1. **Put the application into maintenance mode** (Admin → System →
   Maintenance → Enable). This prevents new writes from polluting
   recovery state.
2. **Check the latest backup** in the Backup History page. Look for the
   most recent `VERIFIED` entry.
3. **Download the backup archive** locally as a safety copy.
4. **Restore the backup** using the procedure above.
5. **Verify the restore**: navigate the admin panel, check user counts,
   recent records, and the audit log.
6. **Disable maintenance mode** once the application is healthy.
7. **File a post-mortem** documenting the root cause + recovery steps.

## Storage credentials

- `AUTH_SECRET` — required to decrypt any backup. Stored in your hosting
  provider's secret manager (Vercel Project → Settings → Environment
  Variables, marked as Secret).
- `DATABASE_URL` — MongoDB connection string. Same location.
- `BACKUP_STORAGE_PROVIDER` + bucket credentials — only required for
  external storage (S3 / R2 / Vercel Blob). For the default `local`
  provider, backups live in MongoDB alongside the application data.

> **NEVER** commit these values to source control. **NEVER** paste them
> into the admin UI. **NEVER** share them in chat or email.

## Application redeployment

If the application itself is broken (not the data):

1. Push the fix to the `main` branch — Vercel auto-deploys.
2. If auto-deploy is disabled, trigger a manual deploy from the Vercel dashboard.
3. For rollbacks, use Vercel's "Instant Rollback" feature to a previous deployment.
4. Run `bun run db:push` only if the schema changed.
5. Run `bun run seed` only for fresh installs.

## Recovery checklist

- [ ] Maintenance mode enabled
- [ ] Latest VERIFIED backup identified
- [ ] Backup downloaded to local safe location
- [ ] Safety backup created (automatic on restore)
- [ ] Restore operation completed successfully
- [ ] Per-model restore counts reviewed (no unexpected 0s)
- [ ] Sample records verified in admin UI
- [ ] Audit log shows restore event
- [ ] Maintenance mode disabled
- [ ] Post-mortem document filed
