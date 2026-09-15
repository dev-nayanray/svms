"use client";

import { PageHeader } from "@/components/shared/page-kit";
import { SectionCard } from "./shared";
import { AlertTriangle, ShieldCheck, DatabaseBackup, Clock, FileText, Server } from "lucide-react";

/**
 * Disaster Recovery documentation page — static content describing the
 * backup strategy, RPO/RTO targets, restore procedure, and emergency
 * steps. No credentials or secrets are shown.
 */
export function DisasterRecovery() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Disaster Recovery"
        description="Backup strategy, restore procedure, and emergency steps. No credentials are shown here — they live in your hosting provider's secret manager."
        breadcrumbs={["Admin", "System Administration", "Disaster Recovery"]}
      />

      <SectionCard
        title="Backup Strategy"
        description="How backups are taken, encrypted, stored, and verified."
        actions={<DatabaseBackup className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="space-y-3 text-sm">
          <p>
            <strong>Frequency:</strong> Daily, weekly, and monthly backups are configured via Vercel Cron
            (see <code className="rounded bg-muted px-1.5 py-0.5 text-xs">vercel.json</code>). Each runs at 02:00 UTC
            and stores the result in MongoDB (StoredFile collection, kind=<code className="rounded bg-muted px-1.5 py-0.5 text-xs">system-backup</code>).
          </p>
          <p>
            <strong>Format:</strong> JSON-line stream (one JSON object per document per line). This format
            is human-readable, streamable, and resilient to partial corruption (a single bad line does not
            invalidate the rest of the archive).
          </p>
          <p>
            <strong>Encryption:</strong> AES-256-GCM with a key derived from <code className="rounded bg-muted px-1.5 py-0.5 text-xs">AUTH_SECRET</code>
            via scrypt (per-backup random salt). The salt + IV + auth tag are stored on the BackupRecord.
            The encryption key is NEVER persisted — anyone with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">AUTH_SECRET</code> can decrypt.
          </p>
          <p>
            <strong>Verification:</strong> After each backup completes, the verification routine decrypts
            the archive, recomputes the SHA-256, parses every JSON line, and validates that each document
            has an <code className="rounded bg-muted px-1.5 py-0.5 text-xs">id</code> field. Backups are marked <code className="rounded bg-muted px-1.5 py-0.5 text-xs">VERIFIED</code> only when every check passes.
          </p>
          <p>
            <strong>Retention:</strong> 7 daily, 4 weekly, 12 monthly backups. The system refuses to delete
            the only known valid backup. A daily cron job purges soft-deleted backups older than 24 hours.
          </p>
          <p>
            <strong>What is NOT backed up:</strong>
          </p>
          <ul className="ml-6 list-disc text-muted-foreground">
            <li><code className="text-xs">User.passwordHash</code> — stripped to prevent credential leakage</li>
            <li><code className="text-xs">StoredFile.data</code> bytes — only metadata (size, mime, hash) is backed up. For full disaster recovery of binary files, use MongoDB Atlas&apos;s native snapshot feature.</li>
            <li>Any field matching <code className="text-xs">/secret|token|password|apiKey/i</code> is stripped</li>
          </ul>
        </div>
      </SectionCard>

      <SectionCard
        title="RPO / RTO Targets"
        description="Recovery Point Objective + Recovery Time Objective."
        actions={<Clock className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-info/30 bg-info/5 p-4">
            <p className="text-xs uppercase tracking-wide text-info">RPO (Recovery Point Objective)</p>
            <p className="mt-2 text-2xl font-bold">24 hours</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Worst case data loss = 1 day (between daily backups). For tighter RPO, increase backup frequency.
            </p>
          </div>
          <div className="rounded-md border border-info/30 bg-info/5 p-4">
            <p className="text-xs uppercase tracking-wide text-info">RTO (Recovery Time Objective)</p>
            <p className="mt-2 text-2xl font-bold">2 hours</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Estimated time to restore from backup + verify application health.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Restore Procedure"
        description="Step-by-step restore from a verified backup."
        actions={<FileText className="h-4 w-4 text-muted-foreground" />}
      >
        <ol className="ml-6 list-decimal space-y-2 text-sm">
          <li>
            Navigate to <strong>Admin → System Administration → Backup &amp; Restore</strong>.
          </li>
          <li>
            Identify the backup you want to restore. Prefer <code className="rounded bg-muted px-1.5 py-0.5 text-xs">VERIFIED</code> backups.
          </li>
          <li>
            Click the <strong>Verify</strong> button if not already verified. Wait for the verification report.
          </li>
          <li>
            Click the <strong>Restore</strong> button. A dialog will appear with full details of the backup.
          </li>
          <li>
            The system automatically creates a <strong>safety backup</strong> before any restore operation.
          </li>
          <li>
            Type the confirmation phrase <code className="rounded bg-muted px-1.5 py-0.5 text-xs">I UNDERSTAND THE RISK</code>.
          </li>
          <li>
            If the backup is unverified, check the <em>&quot;acknowledge risk&quot;</em> checkbox (NOT recommended).
          </li>
          <li>
            Click <strong>Restore Now</strong>. The restore runs synchronously and returns a per-model summary.
          </li>
          <li>
            After restore, refresh affected pages and verify data integrity. If anything looks wrong, restore
            from the safety backup created in step 5.
          </li>
        </ol>
      </SectionCard>

      <SectionCard
        title="Emergency Procedure"
        description="What to do if the production database is down or corrupted."
        actions={<AlertTriangle className="h-4 w-4 text-destructive" />}
      >
        <ol className="ml-6 list-decimal space-y-2 text-sm">
          <li>
            <strong>Put the application into maintenance mode</strong> (Admin → System → Maintenance → Enable).
            This prevents new writes from polluting recovery state.
          </li>
          <li>
            <strong>Check the latest backup</strong> in the Backup History page. Look for the most recent
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs ml-1">VERIFIED</code> entry.
          </li>
          <li>
            <strong>Download the backup archive</strong> locally as a safety copy (the download link is in
            the Actions column of the backup row).
          </li>
          <li>
            <strong>Restore the backup</strong> using the procedure above.
          </li>
          <li>
            <strong>Verify the restore</strong>: navigate the admin panel, check user counts, recent
            records, and the audit log.
          </li>
          <li>
            <strong>Disable maintenance mode</strong> once the application is healthy.
          </li>
          <li>
            <strong>File a post-mortem</strong> documenting the root cause + recovery steps.
          </li>
        </ol>
      </SectionCard>

      <SectionCard
        title="Storage Credentials Location"
        description="Where to find the secrets required for restore."
        actions={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="space-y-2 text-sm">
          <p>
            <strong>AUTH_SECRET</strong> — required to decrypt any backup. Stored in your hosting provider&apos;s
            secret manager (Vercel Project → Settings → Environment Variables, marked as Secret).
          </p>
          <p>
            <strong>DATABASE_URL</strong> — the MongoDB connection string for the target database. Same location.
          </p>
          <p>
            <strong>BACKUP_STORAGE_PROVIDER</strong> + bucket credentials — only required if you&apos;ve configured
            external storage (S3 / R2 / Vercel Blob). For the default <code className="text-xs">local</code> provider,
            backups live in MongoDB alongside the application data.
          </p>
          <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
            <strong>Never</strong> commit these values to source control. Never paste them into the admin UI.
            Never share them in chat or email.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Application Redeployment"
        description="If the application itself is broken (not the data), redeploy from source."
        actions={<Server className="h-4 w-4 text-muted-foreground" />}
      >
        <ol className="ml-6 list-decimal space-y-2 text-sm">
          <li>Push the fix to the <code className="text-xs">main</code> branch — Vercel auto-deploys.</li>
          <li>If auto-deploy is disabled, trigger a manual deploy from the Vercel dashboard.</li>
          <li>For rollbacks, use Vercel&apos;s &quot;Instant Rollback&quot; feature to a previous deployment.</li>
          <li>Run <code className="rounded bg-muted px-1.5 py-0.5 text-xs">bun run db:push</code> only if the schema changed.</li>
          <li>Run <code className="rounded bg-muted px-1.5 py-0.5 text-xs">bun run seed</code> only for fresh installs.</li>
        </ol>
      </SectionCard>

      <SectionCard
        title="Recovery Checklist"
        description="Use this checklist during a recovery operation."
      >
        <ul className="space-y-1 text-sm">
          {[
            "Maintenance mode enabled",
            "Latest VERIFIED backup identified",
            "Backup downloaded to local safe location",
            "Safety backup created (automatic on restore)",
            "Restore operation completed successfully",
            "Per-model restore counts reviewed (no unexpected 0s)",
            "Sample records verified in admin UI",
            "Audit log shows restore event",
            "Maintenance mode disabled",
            "Post-mortem document filed",
          ].map((step) => (
            <li key={step} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
