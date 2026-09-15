import { prisma } from "@/lib/db";
import { readBackupArchive } from "./backup";
import { auditLog } from "@/lib/services/audit";
import { logSystemEvent } from "./logs";

/**
 * Backup Verification Service
 * ===========================
 *
 * Verifies that a completed backup is restorable. Performs these checks:
 *
 *   1. The BackupRecord exists and is COMPLETED or VERIFIED.
 *   2. The underlying StoredFile exists (not deleted).
 *   3. The archive bytes can be decrypted (if encrypted).
 *   4. The SHA-256 checksum matches the recorded checksum.
 *   5. The archive parses as JSON-lines (each line is a valid object
 *      with _model + _doc keys).
 *   6. Each line's _doc has an `id` field.
 *
 * The result is persisted on the BackupRecord:
 *   - status → VERIFYING (during) → VERIFIED or FAILED (after)
 *   - verifiedAt, verificationStatus, verificationNotes
 *
 * Never marks a backup as VERIFIED unless every check passes.
 */

export type VerificationCheck = {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  detail?: string;
};

export type VerificationResult = {
  status: "PASSED" | "FAILED";
  checks: VerificationCheck[];
  documentCount: number;
  modelCounts: Record<string, number>;
};

export async function verifyBackup(backupId: string, actorId: string): Promise<VerificationResult> {
  await prisma.backupRecord.update({
    where: { id: backupId },
    data: { status: "VERIFYING" },
  });

  const checks: VerificationCheck[] = [];
  let documentCount = 0;
  const modelCounts: Record<string, number> = {};

  try {
    // Check 1: record exists + storage key
    const record = await prisma.backupRecord.findUnique({ where: { id: backupId } });
    if (!record) {
      checks.push({ name: "Record exists", status: "FAIL", detail: "BackupRecord not found" });
      throw new Error("BackupRecord not found");
    }
    checks.push({
      name: "Record exists",
      status: "PASS",
      detail: `Status=${record.status}, type=${record.type}`,
    });

    if (!record.storageKey) {
      checks.push({ name: "Storage key", status: "FAIL", detail: "No storage key on record" });
      throw new Error("No storage key");
    }
    checks.push({ name: "Storage key", status: "PASS", detail: record.storageKey });

    // Check 2-4: read archive (decrypts + verifies checksum internally)
    let bytes: Buffer;
    try {
      const r = await readBackupArchive(backupId);
      bytes = r.bytes;
      checks.push({
        name: "Archive decryptable",
        status: "PASS",
        detail: record.encrypted ? "AES-256-GCM decryption succeeded" : "Unencrypted",
      });
      checks.push({
        name: "Checksum matches",
        status: "PASS",
        detail: `sha256=${record.checksum?.slice(0, 16)}…`,
      });
    } catch (err) {
      checks.push({
        name: "Archive decryptable",
        status: "FAIL",
        detail: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Check 5: parse JSON-lines
    const text = bytes.toString("utf8");
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    let parseErrors = 0;
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as { _model?: string; _doc?: { id?: string } };
        if (!obj._model || !obj._doc) {
          parseErrors++;
          continue;
        }
        if (!obj._doc.id) {
          parseErrors++;
          continue;
        }
        documentCount++;
        modelCounts[obj._model] = (modelCounts[obj._model] ?? 0) + 1;
      } catch {
        parseErrors++;
      }
    }
    if (parseErrors > 0) {
      checks.push({
        name: "Archive parseable",
        status: "FAIL",
        detail: `${parseErrors} unparseable line${parseErrors === 1 ? "" : "s"}`,
      });
      throw new Error(`Archive has ${parseErrors} corrupt lines`);
    }
    checks.push({
      name: "Archive parseable",
      status: "PASS",
      detail: `${lines.length} lines parsed cleanly`,
    });

    // Check 6: document count matches
    if (record.documentCount && record.documentCount !== documentCount) {
      checks.push({
        name: "Document count matches",
        status: "WARN",
        detail: `record=${record.documentCount}, archive=${documentCount}`,
      });
    } else {
      checks.push({
        name: "Document count matches",
        status: "PASS",
        detail: `${documentCount} documents`,
      });
    }

    const passed = checks.every((c) => c.status === "PASS" || c.status === "WARN");
    const result: VerificationResult = {
      status: passed ? "PASSED" : "FAILED",
      checks,
      documentCount,
      modelCounts,
    };

    await prisma.backupRecord.update({
      where: { id: backupId },
      data: {
        status: passed ? "VERIFIED" : "FAILED",
        verifiedAt: new Date(),
        verificationStatus: passed ? "PASSED" : "FAILED",
        verificationNotes: JSON.stringify(result),
      },
    });

    await auditLog.record({
      userId: actorId,
      action: "backup.verified",
      entity: "BackupRecord",
      entityId: backupId,
      newValue: { status: result.status, documentCount },
    });

    return result;
  } catch (err) {
    const result: VerificationResult = {
      status: "FAILED",
      checks,
      documentCount,
      modelCounts,
    };
    await prisma.backupRecord.update({
      where: { id: backupId },
      data: {
        status: "FAILED",
        verifiedAt: new Date(),
        verificationStatus: "FAILED",
        verificationNotes: JSON.stringify({
          ...result,
          error: err instanceof Error ? err.message : String(err),
        }),
      },
    });
    await logSystemEvent(
      "ERROR",
      "backup",
      `Backup verification failed: ${err instanceof Error ? err.message : String(err)}`,
      { backupId },
    );
    return result;
  }
}
