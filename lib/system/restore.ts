import { prisma } from "@/lib/db";
import { readBackupArchive, createBackup } from "./backup";
import { auditLog } from "@/lib/services/audit";
import { logSystemEvent } from "./logs";

/**
 * Restore Service
 * ===============
 *
 * Restores a backup archive into the database.
 *
 * HIGH-RISK OPERATION. The caller (API route) MUST ensure:
 *  1. User has `backup.restore` permission (admin only).
 *  2. Backup has been verified (verificationStatus === "PASSED") OR
 *     the user has explicitly acknowledged the risk.
 *  3. The user has typed the confirmation phrase "I UNDERSTAND THE RISK".
 *  4. A safety backup has been created first (if technically possible).
 *
 * Restore ordering for application-level restore (avoid orphaned FKs):
 *
 *   Users → Students → Applications → Documents → Visa → Payments →
 *   Invoices → Tasks → Appointments → Messages → Notifications
 *
 * In practice, MongoDB doesn't enforce FK constraints, so we restore
 * in dependency order but never abort if a referenced parent is
 * missing — we just skip the orphaned child.
 */

const RESTORE_ORDER = [
  "Role",
  "Permission",
  "Branch",
  "User",
  "Employee",
  "Student",
  "AcademicRecord",
  "EnglishProficiency",
  "StudentPreference",
  "Lead",
  "CounselingRequest",
  "Country",
  "University",
  "Course",
  "Intake",
  "ApplicationStage",
  "Application",
  "ApplicationStatusHistory",
  "UniversityFavorite",
  "DocumentRequirement",
  "Document",
  "VisaRequirement",
  "VisaApplication",
  "Task",
  "Appointment",
  "Note",
  "Conversation",
  "Message",
  "Notification",
  "Invoice",
  "Payment",
  "SiteSetting",
  "SystemSetting",
  "AuditLog",
  "BackupRecord",
  "BackupSchedule",
  "SystemHealthCheck",
  "SecurityEvent",
  "MaintenanceWindow",
];

export type RestoreOptions = {
  /** When false, skip documents whose id already exists (idempotent). */
  skipExisting?: boolean;
  /** Restrict restore to these models only (SELECTIVE restore). */
  onlyModels?: string[];
};

export type RestoreResult = {
  safetyBackupId?: string;
  restored: Record<string, { inserted: number; skipped: number; errors: number }>;
  totalInserted: number;
  totalSkipped: number;
  totalErrors: number;
  durationMs: number;
};

export async function restoreBackup(
  backupId: string,
  actorId: string,
  options: RestoreOptions = {},
): Promise<RestoreResult> {
  const startedAt = Date.now();

  // 1. Try to create a safety backup first (best-effort).
  let safetyBackupId: string | undefined;
  try {
    const safety = await createBackup({
      type: "FULL",
      scope: ["*"],
      trigger: "pre-restore-safety",
      createdById: actorId,
    });
    safetyBackupId = safety.id;
  } catch (err) {
    await logSystemEvent(
      "WARNING",
      "restore",
      `Could not create pre-restore safety backup: ${err instanceof Error ? err.message : String(err)}`,
      { backupId },
    );
  }

  // 2. Read + decrypt + verify checksum
  const { bytes } = await readBackupArchive(backupId);

  // 3. Parse archive into per-model batches
  const lines = bytes.toString("utf8").split("\n").filter((l) => l.trim().length > 0);
  const byModel = new Map<string, Record<string, unknown>[]>();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as { _model: string; _doc: Record<string, unknown> };
      const arr = byModel.get(obj._model) ?? [];
      arr.push(obj._doc);
      byModel.set(obj._model, arr);
    } catch {
      // skip corrupt line
    }
  }

  // 4. Restore in dependency order
  const restored: RestoreResult["restored"] = {};
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const model of RESTORE_ORDER) {
    if (options.onlyModels && !options.onlyModels.includes(model)) continue;
    const docs = byModel.get(model);
    if (!docs || docs.length === 0) continue;

    const deleg = (prisma as unknown as Record<string, {
      upsert: (a: { where: { id: string }; create: unknown; update: unknown }) => Promise<unknown>;
      count: (a: { where: { id: string } }) => Promise<number>;
    }>)[model[0].toLowerCase() + model.slice(1)];
    if (!deleg) continue;

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of docs) {
      try {
        const id = doc.id as string;
        if (!id) {
          errors++;
          continue;
        }
        if (options.skipExisting !== false) {
          const exists = await deleg.count({ where: { id } });
          if (exists > 0) {
            skipped++;
            continue;
          }
        }
        await deleg.upsert({
          where: { id },
          create: doc,
          update: doc,
        });
        inserted++;
      } catch (err) {
        errors++;
        await logSystemEvent(
          "WARNING",
          "restore",
          `Failed to restore ${model} doc: ${err instanceof Error ? err.message : String(err)}`,
          { backupId, model, docId: doc.id as string },
        );
      }
    }

    restored[model] = { inserted, skipped, errors };
    totalInserted += inserted;
    totalSkipped += skipped;
    totalErrors += errors;
  }

  // 5. Mark the backup as restored
  await prisma.backupRecord.update({
    where: { id: backupId },
    data: { restoredAt: new Date(), restoredById: actorId },
  });

  await auditLog.record({
    userId: actorId,
    action: "backup.restored",
    entity: "BackupRecord",
    entityId: backupId,
    newValue: {
      safetyBackupId,
      totalInserted,
      totalSkipped,
      totalErrors,
      onlyModels: options.onlyModels,
    },
  });

  return {
    safetyBackupId,
    restored,
    totalInserted,
    totalSkipped,
    totalErrors,
    durationMs: Date.now() - startedAt,
  };
}
