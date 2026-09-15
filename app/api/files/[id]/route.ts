import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { fileStorage } from "@/lib/services/file-storage";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/files/[id]
 *
 * Serves files persisted in MongoDB (profile photos, brand assets).
 * Student documents are NOT served here — they use the ownership-checked
 * /api/student/documents/[id]/download endpoint exclusively.
 *
 * Requires an authenticated session (same-origin <img> tags send
 * cookies, so in-app avatars render fine; hotlinking from elsewhere
 * gets a 401).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.download, "files");
    if (limited) return limited as Response;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
    }

    const { id } = await params;
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "File not found" } }, { status: 404 });
    }

    // Documents stay behind their dedicated download endpoint.
    const file = await fileStorage.get(id);
    if (!file || file.kind === "student-doc") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "File not found" } }, { status: 404 });
    }

    const safeName = file.fileName.replace(/[^\w\d.\- ]+/g, "_");
    return new NextResponse(file.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": `inline; filename="${safeName}"`,
        // Private (session-gated) but cacheable in the browser — avatar
        // URLs are content-addressed (new upload = new id), so a stale
        // cache can't show the wrong photo.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
