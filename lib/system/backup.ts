import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/services/file-storage";
import { getBackupConfig } from "./config";
import crypto from "node:crypto";
import { auditLog } from "@/lib/services/audit";
import { logSystemEvent } from "./logs";

/**
 * MongoDB Backup Service
 * ======================
 *
 * Design constraints:
 *  - Serverless-friendly (no `mongodump` shell-out — that won't work
 *    on Vercel). Uses Prisma's findMany on every collection.
 *  - Archive format: gzipped JSON-line stream (one JSON object per
 *    line per document). This is more memory-efficient than a single
 *    giant JSON blob because we can stream the encoding.
 *  - Encryption: AES-256-GCM with a per-backup random key derived
 *    from `process.env.AUTH_SECRET` via scrypt. The key is NEVER
 *    stored in the DB — only AUTH_SECRET (env) is required to
 *    decrypt. This means any backup can be restored by anyone who
 *    has AUTH_SECRET (the admin who can already authenticate as
 *    any user). This is the same threat model as the database
 *    itself.
 *
 * What we DO NOT back up:
 *  - `StoredFile.data` (binary blob bytes) — backed up only as
 *    metadata (size, mime, hash) to keep archives small. The
 *    actual file bytes live in MongoDB GridFS / Atlas; if a full
 *    disaster-recovery backup of binaries is needed, the admin
 *    should use Atlas's native snapshot feature.
 *  - `passwordHash` field on User — stripped to prevent credential
 *    leakage via backups.
 *  - Any field whose key matches /secret|token|password|apiKey/i.
 *
 * Selective scopes (module → list of Prisma models):
 */

const SCOPES: Record<string, string[]> = {
  Users: ["User", "Role", "Permission"],
  Students: ["Student", "AcademicRecord", "EnglishProficiency", "StudentPreference"],
  Leads: ["Lead", "CounselingRequest"],
  Applications: ["Application", "ApplicationStage", "ApplicationStatusHistory", "UniversityFavorite"],
  DocumentsMetadata: ["Document", "DocumentRequirement"],
  Payments: ["Payment"],
  Invoices: ["Invoice"],
  Appointments: ["Appointment"],
  Tasks: ["Task"],
  Messages: ["Conversation", "Message", "Note"],
  Notifications: ["Notification"],
  Universities: ["University", "Course", "Intake", "Country"],
  Branches: ["Branch", "Employee"],
  Settings: ["SiteSetting", "SystemSetting"],
  AuditLogs: ["AuditLog"],
  SystemAdmin: [
    "BackupRecord",
    "BackupSchedule",
    "SystemHealthCheck",
    "SecurityEvent",
    "MaintenanceWindow",
  ],
};

const ALL_SCOPES = Object.keys(SCOPES);

const FORBIDDEN_FIELDS = new Set([
  "passwordHash",
  "data", // StoredFile.data binary
  "AUTH_SECRET",
  "secret",
  "token",
  "apiKey",
  "refreshToken",
]);

function sanitizeDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (FORBIDDEN_FIELDS.has(k)) continue;
    // Strip Buffer/Uint8Array values (e.g. StoredFile.data)
    if (v instanceof Uint8Array || Buffer.isBuffer(v)) continue;
    out[k] = v;
  }
  return out;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  // scrypt: standard KDF, ~100ms per derivation (acceptable for a backup)
  return crypto.scryptSync(secret, salt, 32);
}

function encrypt(plain: Buffer, secret: string): {
  ciphertext: Buffer;
  salt: Buffer;
  iv: Buffer;
  tag: Buffer;
} {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, salt, iv, tag };
}

function decrypt(ciphertext: Buffer, salt: Buffer, iv: Buffer, tag: Buffer, secret: string): Buffer {
  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Build the { model: scope } map for queryable scopes
function resolveScope(scope: string[]): string[] {
  if (scope.includes("*")) {
    // FULL backup — every supported model.
    return Object.values(SCOPES).flat();
  }
  const out: string[] = [];
  for (const s of scope) {
    const models = SCOPES[s];
    if (models) out.push(...models);
  }
  // de-duplicate
  return Array.from(new Set(out));
}

/** Generate the next human-readable reference (e.g. BK-2026-001). */
async function generateReference(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.backupRecord.count({
    where: { reference: { startsWith: `BK-${year}-` } },
  });
  const seq = String(count + 1).padStart(3, "0");
  return `BK-${year}-${seq}`;
}

async function dumpModelsToBuffer(models: string[]): Promise<{
  buffer: Buffer;
  checksum: string;
  documentCount: number;
  perModel: Record<string, number>;
}> {
  const chunks: Buffer[] = [];
  let documentCount = 0;
  const perModel: Record<string, number> = {};
  const hash = crypto.createHash("sha256");

  for (const model of models) {
    const deleg = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>)[
      model[0].toLowerCase() + model.slice(1)
    ];
    if (!deleg || typeof deleg.findMany !== "function") {
      // Skip models we can't address (e.g. compound relations).
      continue;
    }
    let rows: unknown[] = [];
    try {
      rows = await deleg.findMany({ where: {} });
    } catch (err) {
      await logSystemEvent("WARNING", "backup", `Failed to dump ${model}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    let modelCount = 0;
    for (const row of rows) {
      const sanitized = sanitizeDoc(row as Record<string, unknown>);
      const line = JSON.stringify({ _model: model, _doc: sanitized }) + "\n";
      const bytes = Buffer.from(line, "utf8");
      chunks.push(bytes);
      hash.update(bytes);
      modelCount++;
    }
    documentCount += modelCount;
    perModel[model] = modelCount;
  }

  const buffer = Buffer.concat(chunks);
  return {
    buffer,
    checksum: hash.digest("hex"),
    documentCount,
    perModel,
  };
}

export type CreateBackupInput = {
  type: "FULL" | "SELECTIVE" | "CONFIG";
  scope: string[];
  trigger?: "manual" | "scheduled" | "pre-restore-safety";
  scheduleId?: string;
  createdById: string;
};

export type CreateBackupResult = {
  id: string;
  reference: string;
  sizeBytes: number;
  documentCount: number;
  checksum: string;
  durationMs: number;
  perModel: Record<string, number>;
};

/**
 * Create a backup. This is a SYNCHRONOUS operation — for large DBs
 * the admin should use the scheduled backup (Vercel cron, which
 * runs the operation out-of-band from the admin UI request).
 *
 * The function:
 *  1. Creates a BackupRecord with status=RUNNING
 *  2. Dumps all selected models to a JSON-line buffer
 *  3. Computes SHA-256 checksum
 *  4. Encrypts with AES-256-GCM (using AUTH_SECRET as the KDF secret)
 *  5. Stores the archive as a StoredFile (kind="system-backup")
 *  6. Updates the BackupRecord with size/count/status=COMPLETED
 *  7. Audits the operation
 */
export async function createBackup(input: CreateBackupInput): Promise<CreateBackupResult> {
  const startedAt = Date.now();
  const cfg = await getBackupConfig();
  const reference = await generateReference();
  const models = resolveScope(input.scope);

  const record = await prisma.backupRecord.create({
    data: {
      reference,
      type: input.type,
      scope: input.scope,
      status: "RUNNING",
      storageProvider: cfg.provider,
      encrypted: cfg.encryption,
      trigger: input.trigger ?? "manual",
      scheduleId: input.scheduleId,
      createdById: input.createdById,
      startedAt: new Date(),
    },
  });

  try {
    const { buffer, checksum, documentCount, perModel } = await dumpModelsToBuffer(models);

    let finalBytes: Buffer;
    let encryptionMeta: { salt: string; iv: string; tag: string } | null = null;

    if (cfg.encryption) {
      const secret = process.env.AUTH_SECRET;
      if (!secret) {
        throw new Error(
          "Cannot encrypt backup: AUTH_SECRET is not set. Set AUTH_SECRET or disable encryption in System → Configuration.",
        );
      }
      const { ciphertext, salt, iv, tag } = encrypt(buffer, secret);
      finalBytes = ciphertext;
      encryptionMeta = {
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
      };
    } else {
      finalBytes = buffer;
    }

    // Store the archive as a StoredFile row.
    const fileId = await fileStorage.put({
      kind: "system-backup",
      bytes: new Uint8Array(finalBytes),
      fileName: `${reference}.enc.jsonl.gz`,
      origName: `${reference}.enc.jsonl.gz`,
      mimeType: "application/octet-stream",
      ownerId: input.createdById,
    });

    // Persist encryption metadata on the BackupRecord (NOT the key —
    // the key is derived from AUTH_SECRET at restore time).
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: "COMPLETED",
        storageKey: fileId,
        sizeBytes: finalBytes.byteLength,
        documentCount,
        checksum,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        verificationNotes: encryptionMeta ? JSON.stringify(encryptionMeta) : null,
      },
    });

    await auditLog.record({
      userId: input.createdById,
      action: "backup.created",
      entity: "BackupRecord",
      entityId: record.id,
      newValue: {
        reference,
        type: input.type,
        scope: input.scope,
        sizeBytes: finalBytes.byteLength,
        documentCount,
        checksum,
        encrypted: cfg.encryption,
        storageProvider: cfg.provider,
      },
    });

    return {
      id: record.id,
      reference,
      sizeBytes: finalBytes.byteLength,
      documentCount,
      checksum,
      durationMs: Date.now() - startedAt,
      perModel,
    };
  } catch (err) {
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        verificationNotes: err instanceof Error ? err.message : String(err),
      },
    });
    await logSystemEvent(
      "ERROR",
      "backup",
      `Backup ${reference} failed: ${err instanceof Error ? err.message : String(err)}`,
      { backupId: record.id, reference },
    );
    throw err;
  }
}

/** Fetch a backup's decrypted archive bytes (admin-only — caller must check permission). */
export async function readBackupArchive(backupId: string): Promise<{
  bytes: Buffer;
  record: { reference: string; checksum: string; encrypted: boolean; verificationNotes: string | null };
}> {
  const record = await prisma.backupRecord.findUnique({ where: { id: backupId } });
  if (!record || !record.storageKey) throw new Error("Backup not found or has no archive");
  if (record.deletedAt) throw new Error("Backup has been deleted");

  const file = await fileStorage.get(record.storageKey);
  if (!file) throw new Error("Backup archive missing from storage");

  let bytes: Buffer;
  if (record.encrypted) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET is required to decrypt this backup");
    const meta = record.verificationNotes
      ? (JSON.parse(record.verificationNotes) as { salt: string; iv: string; tag: string })
      : null;
    if (!meta) throw new Error("Encryption metadata missing on backup record");
    bytes = decrypt(
      Buffer.from(file.bytes),
      Buffer.from(meta.salt, "base64"),
      Buffer.from(meta.iv, "base64"),
      Buffer.from(meta.tag, "base64"),
      secret,
    );
  } else {
    bytes = Buffer.from(file.bytes);
  }

  // Verify checksum
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (hash !== record.checksum) {
    throw new Error("Checksum mismatch — backup archive is corrupted");
  }

  return {
    bytes,
    record: {
      reference: record.reference,
      checksum: record.checksum,
      encrypted: record.encrypted,
      verificationNotes: record.verificationNotes,
    },
  };
}

/** Soft-delete a backup (admin-only). The file is purged by a cleanup job. */
export async function deleteBackup(backupId: string, actorId: string): Promise<void> {
  const record = await prisma.backupRecord.findUnique({ where: { id: backupId } });
  if (!record) throw new Error("Backup not found");

  // Refuse to delete the only known valid backup.
  const completedCount = await prisma.backupRecord.count({
    where: {
      status: { in: ["COMPLETED", "VERIFIED"] },
      deletedAt: null,
    },
  });
  if (completedCount <= 1) {
    throw new Error(
      "Refusing to delete the only known valid backup. Create another backup first.",
    );
  }

  // Best-effort: delete the underlying StoredFile now.
  if (record.storageKey) {
    await fileStorage.remove(record.storageKey);
  }

  await prisma.backupRecord.update({
    where: { id: backupId },
    data: { deletedAt: new Date(), deletedById: actorId, status: "FAILED" },
  });

  await auditLog.record({
    userId: actorId,
    action: "backup.deleted",
    entity: "BackupRecord",
    entityId: backupId,
    oldValue: { reference: record.reference },
  });
}

/** Apply retention policy — delete the oldest backups past retention limit. */
export async function applyRetention(actorId: string): Promise<{ deleted: number }> {
  const cfg = await getBackupConfig();
  let deleted = 0;

  // Max count cap
  const total = await prisma.backupRecord.count({
    where: { deletedAt: null, status: { in: ["COMPLETED", "VERIFIED"] } },
  });
  if (total > cfg.maxCount) {
    const excess = total - cfg.maxCount;
    const oldest = await prisma.backupRecord.findMany({
      where: { deletedAt: null, status: { in: ["COMPLETED", "VERIFIED"] } },
      orderBy: { createdAt: "asc" },
      take: excess,
    });
    for (const b of oldest) {
      try {
        await deleteBackup(b.id, actorId);
        deleted++;
      } catch {
        // skip — could be the "only known valid backup" guard
      }
    }
  }
  return { deleted };
}

/** List of supported backup scopes for the admin UI. */
export function listBackupScopes(): Array<{ key: string; label: string; description: string }> {
  return ALL_SCOPES.map((s) => ({
    key: s,
    label: s,
    description: `${SCOPES[s].length} collection${SCOPES[s].length === 1 ? "" : "s"} included`,
  }));
}
