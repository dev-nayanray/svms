import "server-only";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";

/**
 * Telegram Config Service
 * ========================
 *
 * Stores the Telegram bot token + webhook secret in the database so
 * admins can configure it from the UI (not just environment variables).
 *
 * SECURITY:
 *  - The bot token is a secret — it's NEVER returned in full by getTelegramConfig()
 *  - Only a masked version (••••••••1234) is returned for display
 *  - The full token is only used server-side when making Telegram API calls
 *  - All changes are audited
 *
 * ENV FALLBACK:
 *  - If no DB row exists (or token is null), the service falls back to
 *    TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET env vars
 *  - This preserves backward compatibility with existing deployments
 */

export type TelegramConfigStatus = {
  configured: boolean;
  hasDbToken: boolean;
  hasEnvToken: boolean;
  hasDbSecret: boolean;
  hasEnvSecret: boolean;
  botName: string;
  welcomeMessage: string;
  enabled: boolean;
  webhookUrl: string | null;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
  lastTestError: string | null;
  // Masked token for display (never the full value)
  maskedToken: string | null;
};

/**
 * Get the Telegram config for display. Never returns the full token.
 */
export async function getTelegramConfig(): Promise<TelegramConfigStatus> {
  let row = null;
  try {
    row = await prisma.telegramConfig.findFirst();
  } catch {
    // DB unavailable — fall back to env only
  }

  const dbToken = row?.botToken ?? null;
  const dbSecret = row?.webhookSecret ?? null;
  const envToken = process.env.TELEGRAM_BOT_TOKEN ?? null;
  const envSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? null;

  const token = dbToken ?? envToken;
  const secret = dbSecret ?? envSecret;

  return {
    configured: !!token && !!secret,
    hasDbToken: !!dbToken,
    hasEnvToken: !!envToken,
    hasDbSecret: !!dbSecret,
    hasEnvSecret: !!envSecret,
    botName: row?.botName ?? "Euroscope Assistant",
    welcomeMessage: row?.welcomeMessage ?? "Welcome to Euroscope! I can help you with studying in Europe. What's your name?",
    enabled: row?.enabled ?? false,
    webhookUrl: row?.webhookUrl ?? null,
    lastTestStatus: row?.lastTestStatus ?? null,
    lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    lastTestError: row?.lastTestError ?? null,
    maskedToken: token ? maskToken(token) : null,
  };
}

/**
 * Get the FULL bot token (server-side only — never return to client).
 * Checks DB first, falls back to env var.
 */
export async function getTelegramBotToken(): Promise<string | null> {
  try {
    const row = await prisma.telegramConfig.findFirst();
    if (row?.botToken) return row.botToken;
  } catch {
    // DB unavailable
  }
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

/**
 * Get the FULL webhook secret (server-side only).
 */
export async function getTelegramWebhookSecret(): Promise<string | null> {
  try {
    const row = await prisma.telegramConfig.findFirst();
    if (row?.webhookSecret) return row.webhookSecret;
  } catch {
    // DB unavailable
  }
  return process.env.TELEGRAM_WEBHOOK_SECRET ?? null;
}

/**
 * Save the Telegram config (upsert). Creates the singleton row if it doesn't exist.
 * Only saves the token if a non-empty value is provided — sending an empty
 * string clears the stored token (reverts to env var).
 */
export async function saveTelegramConfig(
  input: {
    botToken?: string | null;
    webhookSecret?: string | null;
    webhookUrl?: string | null;
    botName?: string;
    welcomeMessage?: string;
    enabled?: boolean;
  },
  actorId: string,
  ctx?: { ipAddress?: string; userAgent?: string },
): Promise<TelegramConfigStatus> {
  const existing = await prisma.telegramConfig.findFirst();

  // Build the update data — only update fields that are provided
  const data: Record<string, unknown> = {
    updatedById: actorId,
  };
  if (input.botToken !== undefined) {
    // Empty string = clear the token (revert to env)
    data.botToken = input.botToken || null;
  }
  if (input.webhookSecret !== undefined) {
    data.webhookSecret = input.webhookSecret || null;
  }
  if (input.webhookUrl !== undefined) {
    data.webhookUrl = input.webhookUrl || null;
  }
  if (input.botName !== undefined) {
    data.botName = input.botName;
  }
  if (input.welcomeMessage !== undefined) {
    data.welcomeMessage = input.welcomeMessage;
  }
  if (input.enabled !== undefined) {
    data.enabled = input.enabled;
  }

  if (existing) {
    await prisma.telegramConfig.update({ where: { id: existing.id }, data });
  } else {
    await prisma.telegramConfig.create({
      data: {
        botToken: input.botToken || null,
        webhookSecret: input.webhookSecret || null,
        webhookUrl: input.webhookUrl || null,
        botName: input.botName || "Euroscope Assistant",
        welcomeMessage: input.welcomeMessage || "Welcome to Euroscope! I can help you with studying in Europe. What's your name?",
        enabled: input.enabled ?? false,
        updatedById: actorId,
      } as never,
    });
  }

  // Audit — never log the actual token value
  await auditLog.record({
    userId: actorId,
    action: "telegram.config_updated",
    entity: "TelegramConfig",
    entityId: existing?.id ?? "new",
    newValue: {
      botToken: input.botToken !== undefined ? "[REDACTED]" : undefined,
      webhookSecret: input.webhookSecret !== undefined ? "[REDACTED]" : undefined,
      webhookUrl: input.webhookUrl,
      botName: input.botName,
      welcomeMessage: input.welcomeMessage,
      enabled: input.enabled,
    },
    ipAddress: ctx?.ipAddress,
    userAgent: ctx?.userAgent,
  });

  return getTelegramConfig();
}

/**
 * Test the Telegram bot connection by calling the Telegram API directly.
 * Makes a real request to https://api.telegram.org/bot<TOKEN>/getMe
 */
export async function testTelegramConnection(): Promise<{
  status: "connected" | "invalid_token" | "network_error";
  message: string;
  botUsername?: string;
  botFirstName?: string;
}> {
  const token = await getTelegramBotToken();
  if (!token) {
    return {
      status: "invalid_token",
      message: "No bot token configured. Add a token in the settings below or set TELEGRAM_BOT_TOKEN env var.",
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { status: "invalid_token", message: "Invalid bot token. Get a new one from @BotFather." };
      }
      return { status: "network_error", message: `Telegram API returned HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.ok && data.result) {
      // Update the last test status
      await updateTestStatus("connected", null);
      return {
        status: "connected",
        message: `Connected as @${data.result.username} (${data.result.first_name})`,
        botUsername: data.result.username,
        botFirstName: data.result.first_name,
      };
    }

    return { status: "invalid_token", message: "Telegram API rejected the token." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateTestStatus("network_error", msg);
    return { status: "network_error", message: `Network error: ${msg}` };
  }
}

/**
 * Register the webhook with Telegram by calling setWebhook.
 * Uses the configured webhookUrl or auto-detects from NEXT_PUBLIC_APP_URL.
 */
export async function registerTelegramWebhook(): Promise<{
  success: boolean;
  message: string;
  webhookUrl?: string;
}> {
  const token = await getTelegramBotToken();
  const secret = await getTelegramWebhookSecret();
  if (!token) {
    return { success: false, message: "No bot token configured." };
  }
  if (!secret) {
    return { success: false, message: "No webhook secret configured." };
  }

  // Get the webhook URL
  let row = null;
  try {
    row = await prisma.telegramConfig.findFirst();
  } catch {
    // ignore
  }
  const baseUrl = row?.webhookUrl || process.env.NEXT_PUBLIC_APP_URL || "";
  if (!baseUrl) {
    return { success: false, message: "No webhook URL configured. Set NEXT_PUBLIC_APP_URL or enter a custom URL." };
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook?secret=${secret}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (data.ok) {
      return {
        success: true,
        message: "Webhook registered successfully!",
        webhookUrl,
      };
    }
    return {
      success: false,
      message: `Telegram rejected the webhook: ${data.description ?? "Unknown error"}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Update the last test status on the TelegramConfig row.
 */
async function updateTestStatus(status: string, error: string | null): Promise<void> {
  try {
    const existing = await prisma.telegramConfig.findFirst();
    if (existing) {
      await prisma.telegramConfig.update({
        where: { id: existing.id },
        data: { lastTestStatus: status, lastTestedAt: new Date(), lastTestError: error },
      });
    }
  } catch {
    // best-effort
  }
}

/**
 * Mask a token for display: show only the last 4 characters.
 * Example: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz" → "••••••••wxyz"
 */
function maskToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return "••••••••" + token.slice(-4);
}
