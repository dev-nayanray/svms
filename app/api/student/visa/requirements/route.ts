import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentVisaService } from "@/lib/services/student-visa";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/visa/requirements?countryId=<id>
 *
 * Returns ACTIVE visa requirements for the given country. Used by the
 * student UI to show a checklist of what's needed for their
 * destination country's visa application.
 *
 * The `countryId` query parameter is required. If missing, returns 422.
 * Only requirements with `status: ACTIVE` are returned — deleted or
 * deactivated requirements are filtered at the DB level.
 *
 * This route is student-facing but the requirements themselves are
 * admin-managed. Students cannot create, update, or delete
 * requirements — this route is GET-only.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const sp = req.nextUrl.searchParams;
    const countryId = sp.get("countryId");
    if (!countryId) {
      return fail("VALIDATION_ERROR", "countryId query parameter is required", 422, {
        fields: { countryId: "Required" },
      });
    }

    const requirements = await studentVisaService.getRequirements(countryId);
    return ok({ requirements });
  } catch (err) {
    return handleApiError(err);
  }
}
