import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentSettingsService } from "@/lib/services/student-settings";
import { changePasswordSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { auditLog } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/settings/password
 *
 * Change the caller's password. Body validated by
 * `changePasswordSchema`:
 *  - currentPassword: required (verified against stored hash)
 *  - newPassword: min 8 chars, must contain a letter + a number,
 *    must be different from currentPassword
 *
 * The current password is verified server-side via bcrypt.compare.
 * The new password is hashed with bcrypt (10 rounds) before storing.
 * Audit-logged as `student.password_changed` with IP + UA.
 *
 * Rate-limited (5 attempts / IP / min) to slow current-password
 * brute force. Never exposes: passwordHash, resetTokenHash, or any
 * other secret.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate-limit BEFORE bcrypt compare — otherwise an attacker can
    // use this endpoint as a slow oracle by submitting many
    // current-password guesses.
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.passwordChange, "pwchange");
    if (limited) return limited as Response;

    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const input = changePasswordSchema.parse(await req.json());
    const { ipAddress, userAgent } = auditLog.fromRequest(req);
    await studentSettingsService.changePassword(
      g.student.id,
      input.currentPassword,
      input.newPassword,
      g.userId,
      { ipAddress, userAgent },
    );
    return ok({ changed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
