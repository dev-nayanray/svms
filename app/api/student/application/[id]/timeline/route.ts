import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentApplicationService } from "@/lib/services/student-application";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/application/[id]/timeline
 *
 * Returns the timeline view for one application: header fields, full
 * pipeline (with stage state markers), the current-stage callout
 * (label + description + "what happens next"), and the chronological
 * history (newest-first by default). Each history item exposes only
 * the student-safe fields:
 *   - fromStage / toStage (+ their title-cased labels)
 *   - a short student-facing description (looked up from STAGE_DESCRIPTIONS)
 *   - the change-note (intended student-visible — it's a brief label
 *     for the stage transition, NOT an internal `Note` model record)
 *   - the createdAt timestamp
 *   - the display name of who made the change (just `name` — no
 *     email, no phone, no role, no internal ObjectId)
 *
 * Ownership is verified server-side: the query is scoped by the
 * session-resolved `studentId`. A foreign `id` returns null → 404
 * (NOT_FOUND, not 403 — the existence of another student's
 * application is never confirmed).
 *
 * Never exposed: internal employee notes (those are in the `Note`
 * model with `visibility: INTERNAL`, filtered elsewhere), IP
 * addresses, userAgent, audit metadata, internal user IDs,
 * internal role information.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const timeline = await studentApplicationService.getTimeline(g.student.id, id);
    if (!timeline) {
      return fail("NOT_FOUND", "Application not found", 404);
    }
    return ok(timeline);
  } catch (err) {
    return handleApiError(err);
  }
}
