import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { registerTelegramWebhook } from "@/lib/services/telegram-config";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai/telegram/register
 * Registers the webhook with Telegram by calling setWebhook.
 * Uses the DB-stored webhookUrl or auto-detects from NEXT_PUBLIC_APP_URL.
 */
export async function POST(_req: NextRequest) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const result = await registerTelegramWebhook();
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
