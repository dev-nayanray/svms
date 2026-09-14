import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/users/[id]/reset-password — admin resets a user's password.
 *
 * Body: { newPassword?: string } — if not provided, generates a random
 * temp password. Returns the new password (only shown once to the admin).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("employees.update");
    if (g.error) return g.error;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Prevent self-reset via this endpoint (use settings/password instead)
    if (id === g.user.id) {
      return fail("BAD_REQUEST", "Use the settings page to change your own password", 400);
    }

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return fail("NOT_FOUND", "User not found", 404);

    // Generate a random 12-char temp password if not provided
    const newPassword = body.newPassword || generateTempPassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    const { ipAddress, userAgent } = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: "user.password_reset",
      entity: "User",
      entityId: id,
      oldValue: { email: existing.email },
      newValue: { resetBy: g.user.id },
      ipAddress,
      userAgent,
    });

    return ok({ reset: true, tempPassword: newPassword });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Generate a random 12-char password (readable, no ambiguous chars). */
function generateTempPassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
