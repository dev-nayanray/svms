import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentDocumentService } from "@/lib/services/student-document";
import { studentDocumentUploadSchema } from "@/lib/validations";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/constants/documents";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/documents
 *
 * Returns the caller's "current" documents (i.e. rows where no other
 * row has `replacesId = this.id` — superseded rows are hidden from
 * the main list but reachable via the detail endpoint's `history`
 * field). The student record is resolved from the authenticated
 * session — never from a query param or request body.
 *
 * Optional filters:
 *  - ?category=Personal  — narrow by user-facing category
 *  - ?status=APPROVED    — narrow by document status
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const sp = req.nextUrl.searchParams;
    const category = sp.get("category") ?? undefined;
    const status = sp.get("status") ?? undefined;

    const documents = await studentDocumentService.list(g.student.id, {
      category: category ?? undefined,
      status: status ?? undefined,
    });
    return ok({ documents });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/student/documents (multipart/form-data)
 *
 * Form fields:
 *  - file (required, File) — the document file
 *  - name (required, string) — student-facing document name
 *  - category (required, string) — one of DOCUMENT_CATEGORIES
 *  - applicationId (optional, string) — link to an application
 *  - requirementId (optional, string) — link to a DocumentRequirement
 *
 * SECURITY
 *  - Identity is taken from the session, never the body. The
 *    studentId is NOT in the form — it's resolved by studentApiGuard.
 *  - The MIME type is checked against an allow-list, NOT inferred
 *    from the file extension. The on-disk extension is derived from
 *    the MIME type, so a renamed `.exe` cannot execute.
 *  - File size is capped at MAX_FILE_SIZE (10MB) — checked BEFORE
 *    the file touches disk.
 *  - The on-disk filename is a sha-256 hash + timestamp, so
 *    collisions and overwrite attacks don't work, and the original
 *    filename (which may contain PII or special chars) is never
 *    used on disk.
 *  - Files are written to PRIVATE_UPLOAD_DIR (NOT /public/), so they
 *    are NEVER directly accessible via a URL. The only way to read
 *    a file is through /api/student/documents/[id]/download, which
 *    verifies ownership server-side.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate-limit uploads to protect against storage DoS — 20 bursts
    // per IP, +1 token / 3s.
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.upload, "upload");
    if (limited) return limited as Response;

    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return fail("VALIDATION_ERROR", "A file is required", 422, {
        fields: { file: "A file is required" },
      });
    }
    if (file.size === 0) {
      return fail("VALIDATION_ERROR", "File is empty", 422, {
        fields: { file: "File is empty" },
      });
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return fail(
        "VALIDATION_ERROR",
        `Unsupported file type: ${file.type || "unknown"}. Accepted: PDF, JPEG, PNG, WebP.`,
        422,
        { fields: { file: `Unsupported type: ${file.type || "unknown"}` } },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return fail(
        "VALIDATION_ERROR",
        `File exceeds the 10MB limit (received ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
        422,
        { fields: { file: `File is ${file.size} bytes; max is ${MAX_FILE_SIZE}` } },
      );
    }

    // Parse the textual form fields with the Zod schema.
    const input = studentDocumentUploadSchema.parse({
      name: form.get("name"),
      category: form.get("category"),
      applicationId: form.get("applicationId") ?? undefined,
      requirementId: form.get("requirementId") ?? undefined,
    });

    // Read the bytes — small enough (≤10MB) to load into memory safely.
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Write to private storage. The returned fileUrl is a *private path*,
    // NOT a public URL.
    const { fileUrl, fileName } = await studentDocumentService.writePrivateFile(
      g.student.id,
      bytes,
      file.type,
    );

    // Create the Document row. If the DB write fails AFTER the file
    // was written, we clean up the orphan file (best-effort).
    try {
      const doc = await studentDocumentService.createDocument({
        studentId: g.student.id,
        name: input.name,
        category: input.category,
        applicationId: input.applicationId,
        requirementId: input.requirementId,
        fileUrl,
        fileName,
        mimeType: file.type,
        fileSize: file.size,
        actorId: g.userId,
      });
      return ok({ document: doc }, { status: 201 });
    } catch (err) {
      await studentDocumentService.cleanupPrivateFile(fileUrl);
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
