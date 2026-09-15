import { NextRequest, NextResponse } from "next/server";
import { handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentDocumentService } from "@/lib/services/student-document";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/documents/[id]/download
 *
 * Secure download endpoint — the ONLY way to retrieve a document's
 * file. Bytes are stored in MongoDB (see file-storage service), so
 * nothing is ever publicly reachable by URL.
 *
 * Ownership is verified server-side: the query is scoped by
 * `studentId` from the session. A foreign `id` returns 404 (NOT_FOUND,
 * never 403 — the existence of another student's document is never
 * confirmed).
 *
 * The response returns the file with:
 *  - Content-Type: the document's stored mimeType
 *  - Content-Disposition: attachment; filename="<original fileName>"
 *  - Content-Length: the stored byte size
 *
 * REQUESTED documents (no file uploaded yet) return 409 CONFLICT.
 * The download is audit-logged by the service — every file access is
 * recorded (best-effort).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Rate-limit downloads to protect against file-read DoS and
    // audit-log flooding — 60 bursts / IP, +1 token / sec.
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.download, "dl");
    if (limited) return limited as Response;

    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const resolved = await studentDocumentService.resolveForDownload(g.student.id, id, g.userId);
    if (!resolved) {
      return fail("NOT_FOUND", "Document not found or file is missing", 404);
    }

    const { bytes, fileName, mimeType, fileSize } = resolved;

    // Sanitize the filename for the Content-Disposition header.
    // Replace any character that's not alphanumeric, dash, underscore,
    // dot, or space. This prevents header injection via the filename.
    const safeFileName = fileName.replace(/[^\w\d.\- ]+/g, "_");

    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(fileSize),
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
