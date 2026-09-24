import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { runSecurityAudit, getRbacMatrix } from "@/lib/system/security";

/**
 * GET /api/admin/system/security
 * Returns the security audit report + RBAC matrix.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("security.read");
    if (g.error) return g.error;

    const [audit, rbac] = await Promise.all([runSecurityAudit(), Promise.resolve(getRbacMatrix())]);

    return ok({ audit, rbac });
  } catch (err) {
    return handleApiError(err);
  }
}
