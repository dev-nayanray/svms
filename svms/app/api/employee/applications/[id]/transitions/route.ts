import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTransitionPreviews } from "@/lib/services/application-cases";

export const dynamic = "force-dynamic";

/**
 * GET /api/employee/applications/[id]/transitions
 *
 * Returns the current stage + a preview for every other stage showing
 * whether the transition is allowed and, if not, why (block reason).
 * The UI uses this to render the stage selector with blocked indicators.
 *
 * IDOR-safe — the application is resolved via the case-ownership filter.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");

    const { id } = await ctx.params;
    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }
    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const previews = await getTransitionPreviews(scope, id);
    return ok(previews);
  } catch (err) {
    return handleApiError(err);
  }
}
