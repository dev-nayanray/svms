import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { getStudentDashboard } from "@/lib/services/student-dashboard";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/dashboard
 * Returns the caller's own dashboard aggregate only — the student record is
 * resolved from the session server-side, never from client input.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;
    const data = await getStudentDashboard(g.student, g.userId);
    return ok(data);
  } catch (err) {
    return handleApiError(err);
  }
}
