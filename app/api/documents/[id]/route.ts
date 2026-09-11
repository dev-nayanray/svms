import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { documentService } from "@/lib/services/document";
import { documentArchiveSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Get a single document's metadata. The file URL is NOT returned —
 * private documents must never be publicly accessible. The admin UI
 * uses this endpoint to render the document detail/review panel;
 * actual file serving goes through a separate secure-file endpoint
 * (TODO — for now fileUrl is stored but not exposed in this response).
 *
 * Students can only access their own documents.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("documents.read");
    if (g.error) return g.error;
    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
            assignedEmployeeId: true,
          },
        },
        application: {
          select: {
            id: true,
            applicationNumber: true,
            country: { select: { id: true, name: true, flag: true } },
          },
        },
        requirement: { select: { id: true, name: true } },
      },
    });
    if (!doc) throw notFound("Document");

    // Students can only access their own documents
    if (g.user.role === "STUDENT") {
      const me = await prisma.student.findUnique({ where: { userId: g.user.id } });
      if (!me || me.id !== doc.studentId) {
        throw notFound("Document");
      }
    }

    // Strip the fileUrl from the response — it's an internal storage path
    // that should only be accessed via the secure file-serving endpoint.
    const { fileUrl: _fileUrl, ...publicDoc } = doc;
    void _fileUrl;

    return ok(publicDoc);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive or unarchive a document via the `archived` boolean in the
 * body. Soft-deletes (sets deletedAt + deletedBy) so the document
 * retains its data for audit trails.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("documents.review");
    if (g.error) return g.error;
    const { id } = await params;
    const body = documentArchiveSchema.parse(await req.json());
    const doc = await documentService.archive(id, body.archived, g.user);
    return ok(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive (soft delete) a document. Hard delete is intentionally not
 * exposed — document data participates in audit trails and may be
 * needed for compliance.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("documents.review");
    if (g.error) return g.error;
    const { id } = await params;
    const doc = await documentService.archive(id, true, g.user);
    return ok({ archived: true, deletedAt: doc.deletedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
