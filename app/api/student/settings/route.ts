import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentSettingsService } from "@/lib/services/student-settings";
import { studentSettingsPatchSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/settings
 *
 * Returns the caller's preferences (notification toggles, theme,
 * language) + account info (email, phone, name). Creates default
 * preferences if none exist yet (lazy initialization).
 *
 * Never exposes: passwordHash, role, permissions, branchId,
 * assignedEmployeeId, status, or any internal field.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const [preferences, account] = await Promise.all([
      studentSettingsService.getPreferences(g.student.id),
      studentSettingsService.getAccount(g.student.id),
    ]);

    return ok({ preferences, account });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/student/settings
 *
 * Update the caller's preferences (notification toggles, theme,
 * language). Body validated by `studentSettingsPatchSchema` — only
 * the fields in the patch are updated. Ownership is implicit:
 * the query is scoped by studentId from the session.
 *
 * Never allows changing: email (requires verification flow), role,
 * status, assignedEmployeeId, branchId, passwordHash.
 */
export async function PATCH(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const input = studentSettingsPatchSchema.parse(await req.json());
    const preferences = await studentSettingsService.updatePreferences(
      g.student.id,
      input as Record<string, unknown>,
      g.userId,
    );
    return ok({ preferences });
  } catch (err) {
    return handleApiError(err);
  }
}
