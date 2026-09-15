import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { z } from "zod";
import { testSmtpConnection } from "@/lib/services/email";

export const dynamic = "force-dynamic";

const testEmailSchema = z.object({
  email: z.string().email("Valid email required"),
});

/**
 * POST /api/admin/test-email
 *
 * Sends a test email using the SMTP settings configured in
 * Admin → Settings → Email. Admin-only.
 *
 * Returns { ok: boolean, message: string }.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;

    const { email } = testEmailSchema.parse(await req.json());
    const result = await testSmtpConnection(email);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
