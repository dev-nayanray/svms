/**
 * Pure helpers for the Admin Document Management module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The status flow and review rules are the single source of truth
 * for "what can be reviewed / re-requested / archived?" and are enforced
 * at the service level in `lib/services/document.ts`.
 *
 * Document status flow:
 *   REQUESTED → UPLOADED → UNDER_REVIEW → APPROVED | REJECTED → (re-upload)
 *                                                                 ↘ EXPIRED
 *
 * Business rules:
 *  - Approved documents cannot be silently rejected — they must first be
 *    explicitly revoked (status set back to UNDER_REVIEW or REQUESTED).
 *  - Rejection requires a reason (reviewNote).
 *  - "Request Re-upload" resets the document to REQUESTED with a note
 *    explaining why the student needs to re-upload.
 *  - Archived (soft-deleted) documents retain their data for audit trails.
 */

export const DOCUMENT_STATUSES = [
  "REQUESTED",
  "UPLOADED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  REQUESTED: "Requested",
  UPLOADED: "Uploaded",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

/** MIME types allowed for document uploads. Validated server-side. */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Maps a MIME type to a safe file extension. The extension on disk is
 * always derived from the MIME type (never trusted from the client),
 * so a renamed `.exe` cannot execute. Falls back to `.bin`.
 */
export const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * User-facing document categories (Module 06). Optional on the
 * Document model so the existing admin upload flow still works
 * without a category. Used by the student documents UI for the
 * category filter chips.
 */
export const DOCUMENT_CATEGORIES = [
  "Personal",
  "Academic",
  "English Test",
  "Financial",
  "Passport",
  "University",
  "Visa",
  "Other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Returns true if the given string is a valid user-facing category. */
export function isValidDocumentCategory(value: unknown): value is DocumentCategory {
  return typeof value === "string" && (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Returns true if the file's MIME type is previewable inline in the
 * browser (images + PDF). Other supported types (none currently, but
 * the function is here for future DOCX/XLSX preview support) return
 * false and the UI falls back to a download-only CTA.
 */
export function isPreviewable(mimeType: string): boolean {
  return (
    mimeType === "application/pdf" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp"
  );
}

/** Maximum upload file size: 10 MB. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Statuses that can be reviewed (approve / reject / request re-upload). */
export const REVIEWABLE_STATUSES = ["UPLOADED", "UNDER_REVIEW", "REJECTED"] as const;

/** Sort keys allowed for the admin document list. */
export const DOCUMENT_SORT_KEYS = [
  "name",
  "status",
  "uploadedAt",
  "reviewedAt",
  "expiresAt",
  "createdAt",
] as const;
export type DocumentSortKey = (typeof DOCUMENT_SORT_KEYS)[number];

/**
 * Returns true if a document in the given status can be reviewed
 * (approved / rejected / put under review). APPROVED documents cannot
 * be rejected without first being revoked.
 */
export function isReviewable(status: string): boolean {
  return (REVIEWABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Returns true if a document can be "requested for re-upload" — this
 * applies to any non-archived document that isn't already in REQUESTED
 * status. APPROVED documents CAN be re-requested (e.g. the file has
 * expired or the requirement changed), which implicitly revokes the
 * approval.
 */
export function canRequestReupload(status: string): boolean {
  return status !== "REQUESTED" && status !== "EXPIRED";
}

/**
 * Returns true if rejecting a document with the given current status
 * is allowed. APPROVED documents cannot be rejected directly — they
 * must first be revoked (set to UNDER_REVIEW) before rejection.
 */
export function canReject(status: string): boolean {
  return status !== "APPROVED" && status !== "EXPIRED";
}

/**
 * Validate a file's MIME type + size against the server-side policy.
 * Returns an error message string when invalid, null when valid.
 */
export function validateFileMeta(
  mimeType: string,
  fileSize: number,
): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return `File type ${mimeType} is not allowed. Accepted: PDF, JPEG, PNG, WebP.`;
  }
  if (fileSize > MAX_FILE_SIZE) {
    return `File exceeds the 10MB limit (received ${(fileSize / 1024 / 1024).toFixed(1)} MB).`;
  }
  return null;
}

/**
 * Format a file size in bytes as a human-readable string.
 * Returns "—" for nullish input.
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Build a Prisma `where` fragment for the admin document list. Enforces
 * the soft-delete filter (deletedAt null vs not-null based on the
 * `archived` toggle) and AND-combines the optional discovery filters:
 *  - search (document name OR student name)
 *  - status
 *  - countryId (via student.applications.country OR application.country)
 *  - applicationId
 *  - studentId
 *  - employeeId (via student.assignedEmployeeId)
 *  - uploadedFrom / uploadedTo (date range on uploadedAt)
 */
export function buildAdminDocumentWhere(filters: {
  search?: string;
  status?: string;
  countryId?: string;
  applicationId?: string;
  studentId?: string;
  employeeId?: string;
  uploadedFrom?: Date;
  uploadedTo?: Date;
  archived?: boolean;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [
    { deletedAt: filters.archived ? { not: null } : null },
  ];

  if (filters.status) {
    andClauses.push({ status: filters.status });
  }
  if (filters.applicationId) {
    andClauses.push({ applicationId: filters.applicationId });
  }
  if (filters.studentId) {
    andClauses.push({ studentId: filters.studentId });
  }
  if (filters.employeeId) {
    andClauses.push({ student: { assignedEmployeeId: filters.employeeId } });
  }
  if (filters.countryId) {
    andClauses.push({
      application: { countryId: filters.countryId },
    });
  }
  if (search) {
    andClauses.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { fileName: { contains: search, mode: "insensitive" } },
        {
          student: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ],
    });
  }
  // Date range on uploadedAt — both bounds are inclusive.
  if (filters.uploadedFrom || filters.uploadedTo) {
    const range: Record<string, unknown> = {};
    if (filters.uploadedFrom) range.gte = filters.uploadedFrom;
    if (filters.uploadedTo) range.lte = filters.uploadedTo;
    andClauses.push({ uploadedAt: range });
  }

  return { AND: andClauses };
}
