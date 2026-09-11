import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentDocumentService } from "@/lib/services/student-document";
import { studentDocumentReplaceSchema } from "@/lib/validations";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/constants/documents";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/student/documents/[id]/replace (multipart/form-data)
 *
 * Replaces an existing document with a new upload. The OLD document's
 * status (e.g. APPROVED) is PRESERVED — we never silently overwrite.
 * A NEW document row is created with `replacesId` pointing back to
 * the old one; the new row has status=UPLOADED and goes through the
 * normal review cycle.
 *
 * This means:
 *  - An APPROVED document remains APPROVED in the history (it's not
 *    overwritten, it's superseded).
 *  - The new upload starts as UPLOADED and needs review again.
 *  - The student sees the new version as "current" and the old one
 *    as superseded (reachable via the "history" link on the new doc).
 *
 * SECURITY
 *  - Identity is taken from the session, never the body.
 *  - Ownership is verified server-side: the OLD document must
 *    belong to the caller (scoped by `studentId` in the where
 *    clause). Foreign `id` → 404 (NOT_FOUND, never 403).
 *  - MIME + size + extension validated the same way as POST
 *    /api/student/documents.
 *  - The new file is written to PRIVATE_UPLOAD_DIR (NOT /public/).
 *
 * Form fields: same as POST /api/student/documents (file, name,
 * category, optional applicationId, optional requirementId).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id: oldDocumentId } = await params;
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

    const input = studentDocumentReplaceSchema.parse({
      name: form.get("name"),
      category: form.get("category"),
      applicationId: form.get("applicationId") ?? undefined,
      requirementId: form.get("requirementId") ?? undefined,
    });

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Write the new file to private storage first.
    const { fileUrl, fileName } = await studentDocumentService.writePrivateFile(
      g.student.id,
      bytes,
      file.type,
    );

    // Create the new Document row with replacesId pointing to the
    // old one. If this fails, clean up the orphan file (best-effort).
    try {
      const doc = await studentDocumentService.replaceDocument({
        studentId: g.student.id,
        documentId: oldDocumentId,
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
