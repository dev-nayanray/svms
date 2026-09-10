import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { documentService } from "@/lib/services/document";
import { documentReuploadSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Request re-upload of a document. Resets the status to REQUESTED and
 * stores the admin's reason as the reviewNote. Notifies the student.
 *
 * This can be used on any non-archived, non-REQUESTED, non-EXPIRED
 * document — including APPROVED documents (e.g. the file has expired
 * or the requirement changed), which implicitly revokes the approval.
 *
 * Approved documents cannot be silently replaced — re-requesting an
 * upload explicitly revokes the approval and notifies the student,
 * maintaining the audit trail.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("documents.review");
    if (g.error) return g.error;
    const { id } = await params;
    const body = documentReuploadSchema.parse(await req.json());
    const doc = await documentService.requestReupload(id, body.reason, g.user);
    return ok(doc);
  } catch (err) {
    return handleApiError(err);
  }
}
