import { NextRequest, NextResponse } from "next/server";
import { handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentDocumentService } from "@/lib/services/student-document";
import { stat } from "node:fs/promises";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/documents/[id]/download
 *
 * Secure download endpoint — the ONLY way to retrieve a document's
 * file. Files are stored under PRIVATE_UPLOAD_DIR (NOT /public/), so
 * they are never directly accessible via a URL.
 *
 * Ownership is verified server-side: the query is scoped by
 * `studentId` from the session. A foreign `id` returns 404 (NOT_FOUND,
 * never 403 — the existence of another student's document is never
 * confirmed).
 *
 * The response streams the file with:
 *  - Content-Type: the document's stored mimeType
 *  - Content-Disposition: attachment; filename="<original fileName>"
 *  - Content-Length: the file's size on disk
 *
 * REQUESTED documents (no file uploaded yet) return 409 CONFLICT.
 *
 * The download is audit-logged by the service — every file access is
 * recorded (best-effort, doesn't block the download if the audit
 * write fails).
 *
 * Rate limiting: this endpoint is the natural place to add per-student
 * rate limiting (e.g. max 20 downloads/minute). The actual rate
 * limiter is plumbed in the proxy/middleware layer — the endpoint
 * itself is just the access point.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const resolved = await studentDocumentService.resolveForDownload(g.student.id, id);
    if (!resolved) {
      return fail("NOT_FOUND", "Document not found or file is missing", 404);
    }

    const { filePath, fileName, mimeType, fileSize } = resolved;

    // Double-check the file still exists on disk (the service already
    // does this, but it's cheap to re-verify right before streaming).
    let sizeOnDisk: number;
    try {
      const s = await stat(filePath);
      sizeOnDisk = s.size;
    } catch {
      return fail("NOT_FOUND", "File is missing from storage", 404);
    }

    // Stream the file. Using the Web ReadableStream API so the
    // response can be paused/resumed by the client (e.g. on slow
    // connections or user cancel).
    const stream = studentDocumentService.createDownloadStream(filePath);
    const webStream: ReadableStream<Uint8Array> = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => {
          // Node streams emit Buffer (or string in edge cases). Coerce
          // to Uint8Array — Buffer is already a Uint8Array subclass,
          // but TS needs the explicit cast. Strings are encoded to
          // UTF-8 bytes (rare path; only happens if the stream was
          // constructed with a string encoding).
          let u8: Uint8Array;
          if (chunk instanceof Uint8Array) {
            u8 = chunk;
          } else if (typeof chunk === "string") {
            u8 = new TextEncoder().encode(chunk);
          } else {
            u8 = new Uint8Array(chunk as unknown as ArrayBuffer);
          }
          controller.enqueue(u8);
        });
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

    // Sanitize the filename for the Content-Disposition header.
    // Replace any character that's not alphanumeric, dash, underscore,
    // dot, or space. This prevents header injection via the filename.
    const safeFileName = fileName.replace(/[^\w\d.\- ]+/g, "_");

    return new NextResponse(webStream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(sizeOnDisk || fileSize),
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        // Don't cache — file content is private and may change between
        // versions.
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        // Don't allow framing — defense in depth against clickjacking
        // of the download URL.
        "X-Frame-Options": "DENY",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
