import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { documentService } from "@/lib/services/document";
import { documentReviewSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Review a document — approve, reject, or put under review.
 *
 * The `documentReviewSchema` enforces that rejection requires a
 * `reviewNote` (reason). The service layer additionally enforces that
 * APPROVED documents cannot be rejected without first being revoked.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("documents.review");
    if (g.error) return g.error;
    const { id } = await params;
    const body = documentReviewSchema.parse(await req.json());
    const doc = await documentService.review(id, body.decision, body.reviewNote, g.user);
    return ok(doc);
  } catch (err) {
    return handleApiError(err);
  }
}
