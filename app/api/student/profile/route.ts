import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentProfileService } from "@/lib/services/student-profile";
import { studentProfilePatchSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/profile
 *
 * Returns the caller's own profile, masked for display (passport),
 * with academic records, English proficiency records, and a
 * dynamically-computed completion summary. The student record is
 * resolved from the authenticated session — never from a query
 * parameter or request body.
 */
export async function GET() {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const row = await studentProfileService.load(g.student.id);
    return ok(studentProfileService.toView(row));
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/student/profile
 *
 * Self-service profile edits. The body is validated by
 * `studentProfilePatchSchema` — an explicit allow-list. Fields not
 * on the list (studentId, userId, branchId, assignedEmployeeId,
 * status, role, financial fields, etc.) are silently dropped by
 * the schema and never reach Prisma. Critical contact changes
 * (phone, whatsapp, alternativePhone) emit dedicated audit events.
 *
 * Identity is fixed by the session: even if a `studentId` were
 * present in the body, the service uses the row resolved from the
 * session, not from the body.
 */
export async function PATCH(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const raw = await req.json();
    const input = studentProfilePatchSchema.parse(raw);

    // Reject any attempt to sneak ownership fields in. The schema
    // already filters them, but a defensive 422 here turns a bug
    // into a clear signal instead of a silent drop.
    const forbidden = ["studentId", "userId", "branchId", "assignedEmployeeId", "status", "role", "email"];
    const present = forbidden.filter((k) => k in (raw ?? {}));
    if (present.length > 0) {
      return fail(
        "VALIDATION_ERROR",
        `These fields cannot be edited from the profile endpoint: ${present.join(", ")}`,
        422,
        { fields: Object.fromEntries(present.map((k) => [k, "Not editable here"])) }
      );
    }

    const updated = await studentProfileService.patch(g.student, input, g.userId);
    return ok(studentProfileService.toView(updated));
  } catch (err) {
    return handleApiError(err);
  }
}
