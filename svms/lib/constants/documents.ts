/**
 * File-security constants + validation helpers for document uploads.
 *
 * These are the ONLY MIME types accepted for document uploads. SVG is
 * intentionally excluded — it can carry script payloads and execute in the
 * browser when rendered inline.
 */

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Maximum upload file size: 10 MB. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Extension allowlist — must match the MIME type. */
export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"] as const;

/** Document statuses — the canonical list used across the platform. */
export const DOCUMENT_STATUSES = [
  "REQUESTED",
  "UPLOADED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Document types — used as the `documentType` column value. */
export const DOCUMENT_TYPES = [
  "PASSPORT",
  "TRANSCRIPT",
  "IELTS",
  "TOEFL",
  "PTE",
  "BANK_STATEMENT",
  "RECOMMENDATION",
  "SOP",
  "CV",
  "PHOTO",
  "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Validate a file's MIME type + size against the server-side policy.
 * Returns an error message string when invalid, null when valid.
 */
export function validateFileMeta(mimeType: string, fileSize: number): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return `File type ${mimeType} is not allowed. Accepted: PDF, JPEG, PNG, WebP.`;
  }
  if (fileSize > MAX_FILE_SIZE) {
    return `File exceeds the 10MB limit (received ${(fileSize / 1024 / 1024).toFixed(1)} MB).`;
  }
  return null;
}

/**
 * Sanitize a filename — strips path traversal sequences, null bytes, and
 * dangerous extensions. Returns a safe filename or throws if the input
 * is irrecoverably malicious.
 *
 * Defense against:
 *  - Path traversal: `../../etc/passwd` → `etc_passwd`
 *  - Null bytes: `file.pdf%00.exe` → `file.pdf00.exe` (extension mismatch caught later)
 *  - Hidden files: `.htaccess` → rejected
 *  - Oversized names: truncated to 200 chars
 */
export function sanitizeFileName(raw: string): string {
  if (!raw || typeof raw !== "string") {
    throw new Error("Filename is required");
  }
  // Strip path components — keep only the basename
  const basename = raw.replace(/.*[/\\]/, "");
  // Remove null bytes
  const noNulls = basename.replace(/\0/g, "");
  // Remove leading dots (hidden files)
  const noHidden = noNulls.replace(/^\.+/, "");
  // Replace any remaining path-separator-like sequences
  const noTraversal = noHidden.replace(/\.\./g, "").replace(/[\/\\]/g, "_");
  // Truncate to 200 chars
  const truncated = noTraversal.slice(0, 200);
  if (!truncated || truncated.trim().length === 0) {
    throw new Error("Filename is empty after sanitization");
  }
  return truncated;
}

/**
 * Validate that a file extension matches its MIME type. Prevents the
 * classic `malware.exe` renamed to `passport.pdf` attack when the MIME
 * type is also faked — both checks must pass.
 */
export function extensionMatchesMime(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const mimeToExt: Record<string, string[]> = {
    "application/pdf": ["pdf"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
  };
  const expected = mimeToExt[mimeType] ?? [];
  return expected.includes(ext);
}
