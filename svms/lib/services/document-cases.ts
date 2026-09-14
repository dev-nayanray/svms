import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { documentScope } from "@/lib/services/employee-dashboard";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  validateFileMeta,
  sanitizeFileName,
  extensionMatchesMime,
} from "@/lib/constants/documents";
import { titleCase } from "@/lib/utils";
import { emitNotification } from "@/lib/services/notification-cases";

/**
 * Employee Document Management service — server-side data layer for
 * /employee/documents (list + review drawer) and the matching APIs.
 *
 * Reuses the dashboard's `documentScope` so case ownership stays
 * consistent. EMPLOYEE sees documents on students assigned to them.
 * ADMIN sees all. Foreign documents return 404 (never 403) — IDOR closure.
 *
 * File security:
 *  - All uploads are validated server-side (MIME, size, extension, filename)
 *  - Filenames are sanitized (path traversal, null bytes, hidden files)
 *  - Downloads require ownership verification — no public file URLs
 *  - Approved documents cannot be silently replaced — versioning via
 *    `previousVersionId` creates a new row rather than overwriting
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type DocumentListFilters = {
  search?: string;
  status?: string;
  documentType?: string;
  studentId?: string;
  applicationId?: string;
  country?: string; // via student.applications.country
  expiryFrom?: string;
  expiryTo?: string;
  uploadedFrom?: string;
  uploadedTo?: string;
};

export type DocumentRow = {
  id: string;
  name: string;
  documentType: string | null;
  status: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  reviewNote: string | null;
  uploadedAt: Date | null;
  reviewedAt: Date | null;
  expiresAt: Date | null;
  version: number;
  previousVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  application: { id: string; applicationNumber: string } | null;
  reviewer: { id: string; name: string } | null;
};

export type DocumentListResult = {
  rows: DocumentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ─────────────────────────────────────────────
// List — paginated with filters
// ─────────────────────────────────────────────

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  REQUESTED: "warning",
  UPLOADED: "info",
  UNDER_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  EXPIRED: "destructive",
};

export async function listDocuments(
  scope: EmployeeScope,
  params: {
    filters?: DocumentListFilters;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<DocumentListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};

  const owner = documentScope(scope);

  // Build field filters
  const fieldFilters: Record<string, unknown> = {};
  if (filters.status) fieldFilters.status = filters.status;
  if (filters.documentType) fieldFilters.documentType = filters.documentType;
  if (filters.studentId) fieldFilters.studentId = filters.studentId;
  if (filters.applicationId) fieldFilters.applicationId = filters.applicationId;

  // Search
  const search = filters.search?.trim();
  const searchFilter = search
    ? { name: { contains: search, mode: "insensitive" as const } }
    : {};

  // Expiry range
  const expiryRange: Record<string, unknown> = {};
  if (filters.expiryFrom) {
    const d = new Date(filters.expiryFrom);
    if (!isNaN(d.getTime())) expiryRange.gte = d;
  }
  if (filters.expiryTo) {
    const d = new Date(filters.expiryTo);
    if (!isNaN(d.getTime())) expiryRange.lte = d;
  }
  if (Object.keys(expiryRange).length > 0) fieldFilters.expiresAt = expiryRange;

  // Uploaded date range
  const uploadedRange: Record<string, unknown> = {};
  if (filters.uploadedFrom) {
    const d = new Date(filters.uploadedFrom);
    if (!isNaN(d.getTime())) uploadedRange.gte = d;
  }
  if (filters.uploadedTo) {
    const d = new Date(filters.uploadedTo);
    if (!isNaN(d.getTime())) uploadedRange.lte = d;
  }
  if (Object.keys(uploadedRange).length > 0) fieldFilters.uploadedAt = uploadedRange;

  const where = { ...owner, ...searchFilter, ...fieldFilters };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, documentType: true, status: true, fileName: true,
        mimeType: true, fileSize: true, fileUrl: true, reviewNote: true,
        uploadedAt: true, reviewedAt: true, expiresAt: true, version: true,
        previousVersionId: true,
        createdAt: true, updatedAt: true,
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        application: { select: { id: true, applicationNumber: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  // Resolve reviewer names via a batched query (the Document model has
  // reviewedById pointing at User.id)
  const reviewerIds = Array.from(new Set(
    rows
      .filter((r) => r.reviewedAt !== null)
      .map((r) => (r as { reviewedById?: string }).reviewedById)
      .filter(Boolean),
  ));
  // Note: we didn't select reviewedById above — re-query the needed ones.
  // In production this would be a single join; for now we do a secondary
  // findMany on documents that have been reviewed.
  const reviewedDocs = reviewerIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        select: { id: true, reviewedById: true },
      })
    : [];
  const reviewerIdByDoc = new Map(reviewedDocs.map((d) => [d.id, d.reviewedById]));
  const uniqueReviewerIds = Array.from(new Set(
    Array.from(reviewerIdByDoc.values()).filter(Boolean),
  )) as string[];
  const reviewers = uniqueReviewerIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: uniqueReviewerIds } },
        select: { id: true, name: true },
      })
    : [];
  const reviewerMap = new Map(reviewers.map((u) => [u.id, u.name]));

  const mapped: DocumentRow[] = rows.map((r) => {
    const reviewerId = reviewerIdByDoc.get(r.id);
    return {
      ...r,
      reviewer: reviewerId
        ? { id: reviewerId, name: reviewerMap.get(reviewerId) ?? "Unknown" }
        : null,
    };
  });

  return {
    rows: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ─────────────────────────────────────────────
// Single document — IDOR-scoped
// ─────────────────────────────────────────────

export async function getDocumentById(
  scope: EmployeeScope,
  id: string,
): Promise<DocumentRow | null> {
  const owner = documentScope(scope);
  const doc = await prisma.document.findFirst({
    where: { id, ...owner },
    select: {
      id: true, name: true, documentType: true, status: true, fileName: true,
      mimeType: true, fileSize: true, reviewNote: true, fileUrl: true,
      uploadedAt: true, reviewedAt: true, expiresAt: true, version: true,
      previousVersionId: true,
      createdAt: true, updatedAt: true,
      student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
      application: { select: { id: true, applicationNumber: true } },
    },
  });
  if (!doc) return null;

  // Resolve reviewer
  let reviewer: { id: string; name: string } | null = null;
  if (doc.reviewedAt) {
    const reviewedDoc = await prisma.document.findFirst({
      where: { id: doc.id },
      select: { reviewedById: true },
    });
    if (reviewedDoc?.reviewedById) {
      const user = await prisma.user.findUnique({
        where: { id: reviewedDoc.reviewedById },
        select: { id: true, name: true },
      });
      if (user) reviewer = user;
    }
  }

  return { ...doc, reviewer };
}

export async function requireDocument(scope: EmployeeScope, id: string) {
  const doc = await getDocumentById(scope, id);
  if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");
  return doc;
}

// ─────────────────────────────────────────────
// Review — approve / reject / under_review
// ─────────────────────────────────────────────

export async function reviewDocument(
  scope: EmployeeScope,
  id: string,
  decision: "APPROVED" | "REJECTED" | "UNDER_REVIEW",
  reviewNote: string | undefined,
  actor: { id: string },
): Promise<{ status: string; reviewedAt: Date }> {
  const owner = documentScope(scope);
  const doc = await prisma.document.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true },
  });
  if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");

  // Rejection REQUIRES a reason
  if (decision === "REJECTED" && (!reviewNote || reviewNote.trim().length === 0)) {
    throw new HttpError(422, "VALIDATION_ERROR", "A rejection reason is required");
  }

  // APPROVED documents cannot be silently re-rejected without explicit re-review
  if (doc.status === "APPROVED" && decision === "REJECTED") {
    throw new HttpError(
      409,
      "CONFLICT",
      "Approved documents cannot be directly rejected. Request a re-upload instead.",
    );
  }

  const now = new Date();
  await prisma.document.update({
    where: { id },
    data: {
      status: decision,
      reviewNote: reviewNote?.trim() || null,
      reviewedById: actor.id,
      reviewedAt: now,
    },
  });

  // Notify the student
  try {
    const fullDoc = await prisma.document.findFirst({
      where: { id },
      select: { student: { select: { userId: true, firstName: true, lastName: true } }, name: true },
    });
    if (fullDoc) {
      await emitNotification({
        userId: fullDoc.student.userId,
        type: `DOCUMENT_${decision}`,
        title: `Document ${decision.toLowerCase()}: ${fullDoc.name}`,
        message: decision === "REJECTED"
          ? `Your document "${fullDoc.name}" was rejected. Reason: ${reviewNote}`
          : `Your document "${fullDoc.name}" was ${decision.toLowerCase().replace("_", " ")}.`,
        link: "/employee/documents",
        entityType: "Document",
        entityId: id,
      });
    }
  } catch (err) {
    console.error("[document-review] notification failed", err);
  }

  return { status: decision, reviewedAt: now };
}

// ─────────────────────────────────────────────
// Request re-upload — resets to REQUESTED with a reason
// ─────────────────────────────────────────────

export async function requestReupload(
  scope: EmployeeScope,
  id: string,
  reason: string,
  actor: { id: string },
): Promise<{ status: string }> {
  if (!reason || reason.trim().length === 0) {
    throw new HttpError(422, "VALIDATION_ERROR", "A re-upload reason is required");
  }

  const owner = documentScope(scope);
  const doc = await prisma.document.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true },
  });
  if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");

  await prisma.document.update({
    where: { id },
    data: {
      status: "REQUESTED",
      reviewNote: reason.trim(),
      reviewedById: actor.id,
      reviewedAt: new Date(),
      // Keep the old fileUrl — the student replaces it on re-upload
    },
  });

  // Notify
  try {
    const fullDoc = await prisma.document.findFirst({
      where: { id },
      select: { student: { select: { userId: true } }, name: true },
    });
    if (fullDoc) {
      await emitNotification({
        userId: fullDoc.student.userId,
        type: "DOCUMENT_REUPLOAD_REQUESTED",
        title: "Document re-upload requested",
        message: `Please re-upload "${fullDoc.name}". Reason: ${reason}`,
        link: "/employee/documents",
        entityType: "Document",
        entityId: id,
      });
    }
  } catch (err) {
    console.error("[document-reupload] notification failed", err);
  }

  return { status: "REQUESTED" };
}

// ─────────────────────────────────────────────
// Upload — validated + sanitized + versioned
// ─────────────────────────────────────────────

export async function uploadDocumentVersion(
  scope: EmployeeScope,
  id: string,
  file: { buffer: Buffer; mimeType: string; fileName: string; fileSize: number },
  _actor: { id: string },
): Promise<{ id: string; version: number }> {
  // 1. Validate file metadata
  const metaError = validateFileMeta(file.mimeType, file.fileSize);
  if (metaError) throw new HttpError(422, "VALIDATION_ERROR", metaError);

  // 2. Sanitize filename
  const safeName = sanitizeFileName(file.fileName);

  // 3. Extension must match MIME type
  if (!extensionMatchesMime(safeName, file.mimeType)) {
    throw new HttpError(422, "VALIDATION_ERROR", `File extension does not match MIME type ${file.mimeType}`);
  }

  // 4. IDOR closure
  const owner = documentScope(scope);
  const doc = await prisma.document.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, version: true, name: true, documentType: true, studentId: true, applicationId: true },
  });
  if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");

  // 5. APPROVED documents cannot be silently replaced — create a new version
  //    row with `previousVersionId` pointing at the old one.
  if (doc.status === "APPROVED") {
    // Create a new document row as version N+1
    const newVersion = await prisma.document.create({
      data: {
        studentId: doc.studentId,
        applicationId: doc.applicationId,
        name: doc.name,
        documentType: doc.documentType,
        fileName: safeName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        // In production, the fileUrl would point at private object storage.
        // For now we store a data URL placeholder — the download endpoint
        // serves it only after ownership verification.
        fileUrl: `data:${file.mimeType};base64,${file.buffer.toString("base64")}`,
        status: "UPLOADED",
        version: doc.version + 1,
        previousVersionId: doc.id,
        uploadedAt: new Date(),
      },
    });
    return { id: newVersion.id, version: newVersion.version };
  }

  // 6. Non-approved document — replace the file in place
  await prisma.document.update({
    where: { id },
    data: {
      fileName: safeName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      fileUrl: `data:${file.mimeType};base64,${file.buffer.toString("base64")}`,
      status: "UPLOADED",
      uploadedAt: new Date(),
      // Clear any previous review — the new file needs re-review
      reviewNote: null,
      reviewedById: null,
      reviewedAt: null,
    },
  });

  return { id: doc.id, version: doc.version };
}

// ─────────────────────────────────────────────
// Download — ownership-verified, no public URL
// ─────────────────────────────────────────────

export async function getDocumentForDownload(
  scope: EmployeeScope,
  id: string,
): Promise<{ fileName: string; mimeType: string; dataUrl: string; fileSize: number }> {
  const owner = documentScope(scope);
  const doc = await prisma.document.findFirst({
    where: { id, ...owner },
    select: { fileName: true, mimeType: true, fileUrl: true, fileSize: true, status: true },
  });
  if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");
  if (!doc.fileUrl) throw new HttpError(404, "NOT_FOUND", "No file attached to this document");

  return {
    fileName: doc.fileName ?? "document",
    mimeType: doc.mimeType ?? "application/octet-stream",
    dataUrl: doc.fileUrl,
    fileSize: doc.fileSize ?? 0,
  };
}

// ─────────────────────────────────────────────
// Constants re-export for the UI
// ─────────────────────────────────────────────

export { DOCUMENT_STATUSES, DOCUMENT_TYPES, STATUS_TONE };
export { titleCase };
