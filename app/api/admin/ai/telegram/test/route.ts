import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { testTelegramConnection } from "@/lib/services/telegram-config";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai/telegram/test
 * Tests the Telegram bot connection by calling the Telegram API directly.
 * Makes a real request to https://api.telegram.org/bot<TOKEN>/getMe
 */
export async function POST(_req: NextRequest) {
  try {
    const g = await guard("system.manage");
    if (g.error) return g.error;
    const result = await testTelegramConnection();
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
