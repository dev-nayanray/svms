import { prisma } from "@/lib/db";
import { STUDENT_LIST_MAX_ROWS } from "@/lib/constants/pagination";
import { HttpError } from "@/lib/api";
import { auditLog } from "./audit";
import { notifications } from "./notification";
import {
  ALLOWED_MIME_TYPES,
  EXT_BY_MIME,
  MAX_FILE_SIZE,
  isPreviewable,
  validateFileMeta,
  type DocumentCategory,
} from "@/lib/constants/documents";
import { createHash } from "node:crypto";
import { mkdir, writeFile, stat, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { createReadStream } from "node:fs";
import type { ReadStream } from "node:fs";
import type { Document as PrismaDocument } from "@prisma/client";

/**
 * Student-scoped Document service for Module 06 (Document Management).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session
 * (via `studentApiGuard()` at the route layer). The service NEVER
 * trusts a `documentId` from the client without re-verifying that
 * the document belongs to the caller. Foreign/missing records both
 * return 404 so the existence of other students' documents is never
 * confirmed.
 *
 * PRIVATE STORAGE
 * ----------------
 * Files are written under `/private-uploads/student-docs/<studentId>/`
 * — NOT under `/public/`. They are NEVER directly accessible via a
 * URL. The only way to read a file is through the
 * `/api/student/documents/[id]/download` endpoint, which verifies
 * ownership server-side and streams the file with the right
 * Content-Type + Content-Disposition headers.
 *
 * The on-disk filename is a sha-256 hash + timestamp, so:
 *  - two students uploading the same file get distinct paths
 *  - overwrite attempts don't collide
 *  - the original filename (which may contain PII or special chars)
 *    is never used on disk
 *
 * VERSION HISTORY
 * ---------------
 * When a student replaces an APPROVED (or any status) document:
 *  - The OLD document row is preserved with its status intact. It is
 *    NOT deleted, NOT modified, NOT overwritten.
 *  - A NEW document row is created with `replacesId` pointing to the
 *    old one. The new row has status=UPLOADED and goes through the
 *    normal review cycle.
 *  - The list endpoint returns only "current" documents — i.e. rows
 *    where no other row has `replacesId = this.id` (the `replacedBy`
 *    relation is empty).
 *  - The detail endpoint shows the version history (the chain of
 *    `replaces` rows) so the student can see what the previous version
 *    was and why they replaced it.
 */

/** The directory where private student documents are stored on disk. */
export const PRIVATE_UPLOAD_DIR = join(process.cwd(), "private-uploads", "student-docs");

/**
 * The fileUrl stored on the Document row is a *private path* (relative
 * to PRIVATE_UPLOAD_DIR), NOT a public URL. The download endpoint
 * translates this path back to a real filesystem path after verifying
 * ownership. Format: `<studentId>/<timestamp>-<sha16>.<ext>`.
 *
 * The path is prefixed with `private:` so we can never confuse it
 * with a public URL — defense in depth in case the fileUrl field ever
 * gets used for legacy public documents.
 */
const PRIVATE_URL_PREFIX = "private:";

export type StudentDocumentView = ReturnType<typeof buildStudentSafeView>;
export type StudentDocumentListItem = ReturnType<typeof buildListItem>;

function buildStudentSafeView(row: PrismaDocument & {
  requirement?: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    // fileUrl is a private path, NOT a public URL — we deliberately
    // do NOT expose it. The download endpoint is the only way to
    // retrieve the file.
    previewable: isPreviewable(row.mimeType),
    uploadedAt: row.uploadedAt,
    reviewedAt: row.reviewedAt,
    expiresAt: row.expiresAt,
    // Internal reviewer notes are only shown to the student when the
    // document has been REJECTED — so the student understands what to
    // fix. For all other statuses (UPLOADED, UNDER_REVIEW, APPROVED,
    // EXPIRED), the reviewer's commentary is hidden to avoid leaking
    // internal opinions (e.g. "passport looks suspicious — verifying
    // authenticity"). Mirrors the masking already applied in
    // student-application.ts:buildApplicationDocumentView.
    reviewNote: row.status === "REJECTED" ? row.reviewNote : null,
    applicationId: row.applicationId,
    requirementId: row.requirementId,
    requirement: row.requirement ? { id: row.requirement.id, name: row.requirement.name } : null,
    replacesId: row.replacesId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildListItem(row: PrismaDocument & {
  requirement?: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    previewable: isPreviewable(row.mimeType),
    uploadedAt: row.uploadedAt,
    reviewedAt: row.reviewedAt,
    expiresAt: row.expiresAt,
    // Same masking as the detail view: only expose reviewNote on REJECTED.
    reviewNote: row.status === "REJECTED" ? row.reviewNote : null,
    requirement: row.requirement ? { id: row.requirement.id, name: row.requirement.name } : null,
    replacesId: row.replacesId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const studentDocumentService = {
  /**
   * List the caller's "current" documents — i.e. rows where no other
   * row has `replacesId = this.id` (the `replacedBy` relation is
   * empty). Superseded rows are hidden from the main list but are
   * still reachable via the detail endpoint's `history` field.
   *
   * Optional `category` filter narrows by the user-facing category.
   * Optional `status` filter narrows by document status.
   */
  async list(
    studentId: string,
    options: { category?: string; status?: string } = {},
  ) {
    const rows = await prisma.document.findMany({
      where: {
        studentId,
        deletedAt: null,
        // Only "current" versions — no other row points to this one
        // via `replacesId`.
        replacedBy: { none: {} },
        ...(options.category ? { category: options.category } : {}),
        ...(options.status ? { status: options.status } : {}),
      },
      include: {
        requirement: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: STUDENT_LIST_MAX_ROWS,
    });
    return rows.map(buildListItem);
  },

  /**
   * Get one document's full detail view + version history. Ownership
   * is verified server-side: the query is scoped by `studentId`, so
   * a foreign `documentId` returns null → the route 404s.
   *
   * The history chain (all rows this document's `replacesId` chain
   * points back to) is also ownership-scoped and returned as a list
   * of summary items, oldest-first.
   */
  async getById(studentId: string, documentId: string) {
    const row = await prisma.document.findFirst({
      where: { id: documentId, studentId, deletedAt: null },
      include: {
        requirement: { select: { id: true, name: true } },
        replaces: {
          include: { requirement: { select: { id: true, name: true } } },
        },
      },
    });
    if (!row) return null;

    // Walk the replaces chain to build the version history.
    const history: ReturnType<typeof buildListItem>[] = [];
    let current = row.replaces;
    while (current) {
      history.unshift(buildListItem(current));
      // Prisma doesn't auto-nest `replaces.replaces`, so we need to
      // query each ancestor. For deep chains this is N queries — but
      // typical chains are 1-2 deep. If we ever need to support very
      // deep chains, switch to findMany with replacesId IN (...) then
      // sort in-memory.
      if (current.replacesId) {
        const ancestor = await prisma.document.findFirst({
          where: { id: current.replacesId, studentId, deletedAt: null },
          include: { requirement: { select: { id: true, name: true } } },
        });
        current = ancestor;
      } else {
        current = null;
      }
    }

    return {
      ...buildStudentSafeView(row),
      history,
      historyCount: history.length,
    };
  },

  /**
   * Validate the uploaded file's metadata (MIME + size). Throws a
   * 400 BAD_REQUEST HttpError on failure — the route's handleApiError
   * turns it into a VALIDATION_ERROR response.
   *
   * NOTE: this validates the MIME type against an allow-list, NOT
   * against the file extension. The on-disk extension is derived
   * from the MIME type, so a renamed `.exe` cannot execute.
   */
  validateFile(mimeType: string, fileSize: number) {
    const err = validateFileMeta(mimeType, fileSize);
    if (err) throw new HttpError(400, "BAD_REQUEST", err);
  },

  /**
   * Write the uploaded file bytes to private storage under
   * `<studentId>/<timestamp>-<sha16>.<ext>`. Returns the private
   * path (prefixed with `private:`) that should be stored on the
   * Document row's `fileUrl` field — this is NOT a public URL.
   */
  async writePrivateFile(
    studentId: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<{ fileUrl: string; fileName: string; filePath: string }> {
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const ext = EXT_BY_MIME[mimeType] ?? ".bin";
    const fileName = `${Date.now()}-${hash}${ext}`;
    const studentDir = join(PRIVATE_UPLOAD_DIR, studentId);
    const filePath = join(studentDir, fileName);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);

    // The fileUrl stored on the row is the private path, prefixed
    // so we can distinguish it from any legacy public-URL fileUrl.
    const fileUrl = `${PRIVATE_URL_PREFIX}${studentId}/${fileName}`;
    return { fileUrl, fileName, filePath };
  },

  /**
   * Translate a stored `fileUrl` (private path) back to a real
   * filesystem path. Throws 404 NOT_FOUND if the fileUrl is not
   * a private path (i.e. it's a legacy public URL or malformed).
   * The caller MUST verify ownership before calling this.
   */
  resolvePrivatePath(fileUrl: string): string {
    if (!fileUrl.startsWith(PRIVATE_URL_PREFIX)) {
      throw new HttpError(404, "NOT_FOUND", "File is not available for download");
    }
    const relPath = fileUrl.slice(PRIVATE_URL_PREFIX.length);
    const filePath = join(PRIVATE_UPLOAD_DIR, relPath);
    // Path containment check — prevent path traversal (H3 fix).
    // After join, the resolved path must start with UPLOAD_DIR.
    // This catches any ".." segments that could escape the upload directory.
    const resolved = resolve(filePath);
    if (!resolved.startsWith(PRIVATE_UPLOAD_DIR + sep) && resolved !== PRIVATE_UPLOAD_DIR) {
      throw new HttpError(404, "NOT_FOUND", "File is not available for download");
    }
    return resolved;
  },

  /**
   * Create a new document row after the upload endpoint has stored
   * the file to private storage. The studentId is taken from the
   * session, never from the body. Notifies the assigned employee and
   * audit-logs the upload.
   */
  async createDocument(input: {
    studentId: string;
    name: string;
    category: DocumentCategory;
    applicationId?: string;
    requirementId?: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    replacesId?: string;
    actorId: string;
  }) {
    this.validateFile(input.mimeType, input.fileSize);

    const doc = await prisma.document.create({
      data: {
        studentId: input.studentId,
        applicationId: input.applicationId ?? null,
        requirementId: input.requirementId ?? null,
        name: input.name,
        category: input.category,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        status: "UPLOADED",
        uploadedById: input.actorId,
        uploadedAt: new Date(),
        replacesId: input.replacesId ?? null,
        deletedAt: null, // ensure the soft-delete key is set (MongoDB schemaless quirk)
      },
      include: {
        requirement: { select: { id: true, name: true } },
      },
    });

    // Notify the assigned employee so they can review the upload.
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: { employee: true },
    });
    if (student?.employee) {
      await notifications.push({
        userId: student.employee.userId,
        type: "DOCUMENT_UPLOADED",
        title: "Document uploaded",
        message: `${student.firstName} uploaded "${input.name}" (${input.category}).`,
      });
    }

    await auditLog.record({
      userId: input.actorId,
      action: input.replacesId
        ? "student_document.replaced"
        : "student_document.uploaded",
      entity: "Document",
      entityId: doc.id,
      newValue: {
        name: input.name,
        category: input.category,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        replacesId: input.replacesId ?? null,
      },
    });

    return buildStudentSafeView(doc);
  },

  /**
   * Replace an existing document. The OLD document's status is
   * preserved (e.g. APPROVED stays APPROVED) — we never silently
   * overwrite. A NEW document row is created with `replacesId`
   * pointing back to the old one; the new row has status=UPLOADED
   * and goes through the normal review cycle.
   *
   * This means:
   *  - An APPROVED document remains APPROVED in the history.
   *  - The new upload starts as UPLOADED and needs review again.
   *  - The student sees the new version as "current" (no row points
   *    to it yet), and the old one as superseded.
   *
   * Ownership is verified server-side: the old document must belong
   * to the caller (scoped by `studentId` in the where clause).
   */
  async replaceDocument(input: {
    studentId: string;
    documentId: string;
    name: string;
    category: DocumentCategory;
    applicationId?: string;
    requirementId?: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    actorId: string;
  }) {
    this.validateFile(input.mimeType, input.fileSize);

    // Verify the old document exists AND belongs to the caller.
    const old = await prisma.document.findFirst({
      where: { id: input.documentId, studentId: input.studentId, deletedAt: null },
    });
    if (!old) {
      throw new HttpError(404, "NOT_FOUND", "Document not found");
    }

    // The new document row carries the same requirement/application
    // as the old one (unless the client explicitly overrode them).
    // The new row points back to the old one via replacesId.
    const created = await this.createDocument({
      studentId: input.studentId,
      name: input.name,
      category: input.category,
      applicationId: input.applicationId ?? old.applicationId ?? undefined,
      requirementId: input.requirementId ?? old.requirementId ?? undefined,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      replacesId: old.id,
      actorId: input.actorId,
    });

    // Audit-log the OLD status so the history of "what was replaced"
    // is preserved even if the old row itself is later archived.
    await auditLog.record({
      userId: input.actorId,
      action: "student_document.replacement_created",
      entity: "Document",
      entityId: old.id,
      oldValue: {
        status: old.status,
        name: old.name,
        fileName: old.fileName,
      },
      newValue: {
        replacedBy: created.id,
        newStatus: "UPLOADED",
      },
    });

    return created;
  },

  /**
   * Resolve a document for secure download. Verifies ownership
   * server-side, then returns the filesystem path + content metadata
   * so the route can stream the file. The caller MUST have called
   * studentApiGuard before this — we don't re-check auth here, only
   * ownership of the document row.
   *
   * Returns null when the document doesn't exist or doesn't belong
   * to the caller. The route 404s in that case.
   */
  async resolveForDownload(studentId: string, documentId: string, userId?: string): Promise<{
    filePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null> {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, studentId, deletedAt: null },
      select: {
        fileUrl: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        status: true,
        name: true,
      },
    });
    if (!doc) return null;

    // Don't allow downloads of REQUESTED documents (no file uploaded yet).
    // For all other statuses (UPLOADED, UNDER_REVIEW, APPROVED, REJECTED,
    // EXPIRED), the file exists on disk and the student owns it.
    if (doc.status === "REQUESTED") {
      throw new HttpError(409, "CONFLICT", "This document has not been uploaded yet");
    }

    let filePath: string;
    try {
      filePath = this.resolvePrivatePath(doc.fileUrl);
    } catch {
      // Legacy public-URL fileUrls are not downloadable via this endpoint.
      return null;
    }

    // Verify the file exists on disk — orphaned DB rows return null
    // so the route can 404 gracefully instead of crashing mid-stream.
    try {
      await stat(filePath);
    } catch {
      return null;
    }

    // Audit the download — file downloads are sensitive (the file
    // might contain a passport scan or financial statement) so we
    // log every access. Best-effort: don't fail the download if the
    // audit log write fails.
    auditLog
      .record({
        userId: userId ?? undefined, // H5 fix — use session userId
        action: "student_document.downloaded",
        entity: "Document",
        entityId: documentId,
        newValue: { fileName: doc.fileName, mimeType: doc.mimeType },
      })
      .catch(() => {});

    return {
      filePath,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
    };
  },

  /**
   * Create a readable stream for the file. The route uses this to
   * pipe the file to the response without buffering the whole thing
   * in memory (important for 10MB PDFs).
   */
  createDownloadStream(filePath: string): ReadStream {
    return createReadStream(filePath);
  },

  /**
   * Best-effort cleanup of a private file. Called when an upload
   * fails AFTER the file was written (e.g. DB write fails). Never
   * throws — orphan files are a janitorial problem, not a
   * user-visible failure.
   */
  async cleanupPrivateFile(fileUrl: string) {
    try {
      const filePath = this.resolvePrivatePath(fileUrl);
      await stat(filePath);
      await unlink(filePath);
    } catch {
      // best-effort
    }
  },
};

/** Constants re-exported for the route layer's convenience. */
export const STUDENT_DOCUMENT_MIME_TYPES = ALLOWED_MIME_TYPES;
export const STUDENT_DOCUMENT_MAX_SIZE = MAX_FILE_SIZE;
