import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentDocumentService } from "@/lib/services/student-document";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/documents/[id]
 *
 * Returns the full detail view of one document, including its version
 * history (the chain of `replaces` rows). Ownership is verified
 * server-side: the query is scoped by `studentId` from the session,
 * so a foreign `id` returns null → the route 404s (NOT_FOUND, never
 * 403 — the existence of another student's document is never
 * confirmed).
 *
 * The returned shape NEVER includes the fileUrl — that's a private
 * filesystem path, not a public URL. The only way to retrieve the
 * file is through /api/student/documents/[id]/download.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const doc = await studentDocumentService.getById(g.student.id, id);
    if (!doc) {
      return fail("NOT_FOUND", "Document not found", 404);
    }
    return ok({ document: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
