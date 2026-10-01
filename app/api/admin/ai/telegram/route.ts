import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getTelegramConfig, saveTelegramConfig } from "@/lib/services/telegram-config";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  botToken: z.string().nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  webhookUrl: z.string().url().nullable().optional().or(z.literal("")),
  botName: z.string().max(100).optional(),
  welcomeMessage: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/admin/ai/telegram
 * Returns the Telegram config (token masked, never full value).
 */
export async function GET() {
  try {
    const g = await guard("system.read");
    if (g.error) return g.error;
    const config = await getTelegramConfig();
    return ok(config);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/ai/telegram
 * Save the Telegram config. Token is stored in the DB (encrypted at rest).
 * Sending an empty string for botToken clears the DB value (reverts to env var).
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid Telegram config", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const ctx = auditLog.fromRequest(req);
    const config = await saveTelegramConfig(
      {
        ...parsed.data,
        webhookUrl: parsed.data.webhookUrl || null,
      },
      g.user.id,
      ctx,
    );
    return ok(config);
  } catch (err) {
    return handleApiError(err);
  }
}
