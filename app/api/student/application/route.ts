import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentApplicationService } from "@/lib/services/student-application";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/application
 *
 * Returns the caller's "primary" application — the most-recently-
 * updated ACTIVE one. Used by /student/application when the student
 * has exactly one application (or as a sensible default for the
 * multi-application selector).
 *
 * Behavior:
 *  - 0 applications → 200 OK with `{ application: null, applications: [] }`
 *  - 1 application → 200 OK with `{ application: <summary>, applications: [...] }`
 *  - 2+ applications → 200 OK with `{ application: <primary summary>, applications: [...] }`
 *
 * The student can then switch which one is "current" via the selector
 * UI; this endpoint always returns the same primary regardless of
 * client state, so the selector decision is a client concern.
 *
 * IDOR-safety: the student record is resolved from the session.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    // Allow `?id=<id>` to fetch a specific application's full view
    // via this same endpoint (single source of truth for "what's
    // my current application?"). The id is verified against the
    // session-resolved student.
    const sp = req.nextUrl.searchParams;
    const requestedId = sp.get("id");

    if (requestedId) {
      const view = await studentApplicationService.getById(g.student.id, requestedId);
      if (!view) {
        // Foreign/missing records both 404 — never confirm another
        // student's application exists.
        return fail("NOT_FOUND", "Application not found", 404);
      }
      return ok({ application: view });
    }

    // No specific id → return the primary + the full list for the selector.
    const [primary, applications] = await Promise.all([
      studentApplicationService.primary(g.student.id),
      studentApplicationService.list(g.student.id),
    ]);

    return ok({ application: primary, applications });
  } catch (err) {
    return handleApiError(err);
  }
}
