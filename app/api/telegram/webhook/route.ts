import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadService } from "@/lib/services/lead";
import { logSystemEvent } from "@/lib/system/logs";
import { getTelegramBotToken, getTelegramWebhookSecret } from "@/lib/services/telegram-config";
import { getProviderAdapter, type ProviderType, type ChatMessage } from "@/lib/ai/adapters/types";

export const dynamic = "force-dynamic";

/**
 * Telegram Bot Webhook
 * =====================
 *
 * Receives messages from Telegram and creates/updates leads.
 *
 * Security:
 *  - Webhook secret verification via the `secret` query parameter
 *    (must match the DB-stored secret or TELEGRAM_WEBHOOK_SECRET env var)
 *  - Rate limiting via Vercel's built-in limits
 *  - No secrets exposed in responses
 *
 * The bot token + webhook secret can be configured from the admin UI
 * (stored in the TelegramConfig table) or via environment variables
 * (TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET). DB takes precedence.
 */

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: "private" | "group" | "supergroup" | "channel";
    };
    text?: string;
    contact?: {
      phone_number: string;
      first_name: string;
      user_id?: number;
    };
  };
};

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Verify the webhook secret from the query parameter.
 * Checks the DB-stored secret first, falls back to env var.
 */
async function verifySecret(req: NextRequest): Promise<boolean> {
  const secret = await getTelegramWebhookSecret();
  if (!secret) return false;
  const provided = req.nextUrl.searchParams.get("secret");
  return provided === secret;
}

/**
 * Send a message to a Telegram chat via the Bot API.
 * Uses the DB-stored bot token (or env fallback).
 */
async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = await getTelegramBotToken();
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch {
    // best-effort — don't fail the webhook if the reply fails
  }
}

/**
 * Get or create the conversation stage for a Telegram chat.
 * Stages: "START" → "AWAITING_NAME" → "AWAITING_CONTACT" → "COMPLETED"
 */
async function getConversationStage(chatId: number): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: `telegram.conv.${chatId}` },
    });
    return (row?.value as string) ?? "START";
  } catch {
    return "START";
  }
}

async function setConversationStage(chatId: number, stage: string, metadata?: Record<string, unknown>): Promise<void> {
  try {
    await prisma.systemSetting.upsert({
      where: { key: `telegram.conv.${chatId}` },
      create: { key: `telegram.conv.${chatId}`, value: { stage, ...metadata } as never },
      update: { value: { stage, ...metadata } as never },
    });
  } catch {
    // best-effort
  }
}

/**
 * Generate an AI response for a Telegram user's message.
 *
 * Uses the first enabled + connected AI provider from the DB.
 * Falls back to the legacy AI_PROVIDER_API_KEY env var if no DB
 * provider is configured.
 *
 * Returns null if no AI provider is available (caller should use
 * the generic "we'll get back to you" fallback).
 *
 * SECURITY:
 *  - The system prompt restricts the AI to Euroscope-related topics
 *  - Never exposes student data, internal IDs, or credentials
 *  - Never makes promises about visas or admission (regulated advice)
 */
async function generateAiResponse(userMessage: string, chatId: number): Promise<string | null> {
  try {
    // Find an enabled AI provider from the DB (priority order)
    const provider = await prisma.aiProvider.findFirst({
      where: { enabled: true, apiKeyEncrypted: { not: null } },
      orderBy: [{ priority: "asc" }],
      include: { models: { where: { enabled: true }, take: 1 } },
    });

    let apiKey: string | null = null;
    let baseUrl: string | undefined = undefined;
    let model: string | null = null;
    let providerType: ProviderType = "openai";

    if (provider && provider.apiKeyEncrypted && provider.defaultModel) {
      // Use DB-configured provider
      apiKey = provider.apiKeyEncrypted;
      baseUrl = provider.baseUrl ?? undefined;
      model = provider.defaultModel;
      providerType = provider.provider as ProviderType;
    } else {
      // Fall back to legacy env vars
      apiKey = process.env.AI_PROVIDER_API_KEY ?? null;
      baseUrl = process.env.AI_PROVIDER_BASE_URL ?? undefined;
      model = process.env.AI_PROVIDER_MODEL ?? "gpt-4o-mini";
      providerType = "openai";
    }

    if (!apiKey || !model) {
      return null; // No provider available
    }

    const adapter = getProviderAdapter(providerType);
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are the Euroscope Assistant, a helpful bot for a student visa consultancy that helps students study in Europe.

Your role:
- Answer questions about studying in Europe (universities, courses, visas, costs, scholarships)
- Be friendly, concise, and helpful
- If you don't know something, say so and suggest the user contact a counselor
- NEVER make specific promises about visa approval or university admission
- NEVER ask for or share sensitive personal information (passport numbers, financial details)
- Keep responses under 200 words for Telegram
- If the user asks to speak to a counselor, tell them our team will reach out

This is a Telegram conversation. Keep your response clean (no markdown tables, no complex formatting). Use simple text with line breaks.`,
      },
      {
        role: "user",
        content: userMessage,
      },
    ];

    const result = await adapter.generate({
      apiKey,
      baseUrl,
      options: {
        messages,
        model,
        temperature: 0.7,
        maxTokens: 300,
        stream: false,
      },
    });

    return result.content || null;
  } catch (err) {
    await logSystemEvent(
      "WARNING",
      "system",
      `AI response failed in Telegram webhook: ${err instanceof Error ? err.message : String(err)}`,
      { chatId },
    );
    return null; // Fall back to generic message
  }
}

/**
 * POST /api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>
 *
 * Handles incoming Telegram updates (messages, contacts).
 */
export async function POST(req: NextRequest) {
  // Verify webhook secret
  if (!(await verifySecret(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update: TelegramUpdate = await req.json();

    // Only handle messages (ignore channel posts, callbacks, etc. for now)
    if (!update.message) {
      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const from = msg.from;

    // Only handle private chats (not group messages)
    if (msg.chat.type !== "private" || !from) {
      return NextResponse.json({ ok: true });
    }

    const stage = await getConversationStage(chatId);
    const platformUserId = String(from.id);
    const conversationId = String(chatId);

    // Handle /start command
    if (msg.text === "/start" || stage === "START") {
      const greeting = from.first_name
        ? `Welcome to Euroscope, ${from.first_name}! 🎓`
        : "Welcome to Euroscope! 🎓";

      await sendTelegramMessage(
        chatId,
        `${greeting}\n\nWe help students study in Europe — from university selection to visa preparation.\n\nTo get started, what's your <b>full name</b>?`,
      );
      await setConversationStage(chatId, "AWAITING_NAME", { platformUserId, username: from.username });
      return NextResponse.json({ ok: true });
    }

    // Handle contact sharing (phone number)
    if (msg.contact) {
      const phone = msg.contact.phone_number;
      const name = msg.contact.first_name || from.first_name;

      // Check if we already have a lead for this conversation
      const { lead, created, duplicateOf } = await leadService.create({
        name,
        phone,
        source: "TELEGRAM",
        sourcePlatformId: platformUserId,
        sourceConversationId: conversationId,
        sourceMessageId: String(msg.message_id),
        priority: "MEDIUM",
      });

      if (created) {
        await sendTelegramMessage(
          chatId,
          `Thank you, ${name}! ✅\n\nYour information has been received. One of our counselors will contact you within 24 hours.\n\nIf you have any questions in the meantime, feel free to ask here.`,
        );
        await setConversationStage(chatId, "COMPLETED", { leadId: lead.id, platformUserId });
        await logSystemEvent("INFO", "system", `New lead from Telegram: ${name}`, { leadId: lead.id, conversationId });
      } else if (duplicateOf) {
        // Duplicate — update the existing lead's last activity
        await sendTelegramMessage(
          chatId,
          `Thanks, ${name}! We already have your information on file. Our team will reach out to you soon. 😊`,
        );
        await setConversationStage(chatId, "COMPLETED", { leadId: duplicateOf, platformUserId });
      }

      return NextResponse.json({ ok: true });
    }

    // Handle text messages based on conversation stage
    if (msg.text) {
      const text = msg.text.trim();

      if (stage === "AWAITING_NAME") {
        // Store the name and ask for contact info
        await setConversationStage(chatId, "AWAITING_CONTACT", { name: text, platformUserId });

        await sendTelegramMessage(
          chatId,
          `Great, ${text}! 👋\n\nNow, please share your <b>phone number</b> so our counselors can reach you.\n\nYou can either:\n• Type your phone number\n• Or tap the button below to share your contact`,
        );

        // Send a keyboard button to share contact
        const token = await getTelegramBotToken();
        if (token) {
          try {
            await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "Tap to share your phone number:",
                reply_markup: {
                  keyboard: [[{ text: "📱 Share my phone number", request_contact: true }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
                },
              }),
            });
          } catch {
            // best-effort
          }
        }
        return NextResponse.json({ ok: true });
      }

      if (stage === "AWAITING_CONTACT") {
        // The user typed a phone number instead of using the button
        const convData = await getConversationStage(chatId);
        const nameMatch = convData.match(/"name":"([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : from.first_name ?? "Telegram User";

        // Basic phone validation — must have at least 8 digits
        const digits = text.replace(/\D/g, "");
        if (digits.length < 8) {
          await sendTelegramMessage(
            chatId,
            `That doesn't look like a valid phone number. Please try again, or tap the button to share your contact.`,
          );
          return NextResponse.json({ ok: true });
        }

        const { lead, created, duplicateOf } = await leadService.create({
          name,
          phone: text,
          source: "TELEGRAM",
          sourcePlatformId: platformUserId,
          sourceConversationId: conversationId,
          sourceMessageId: String(msg.message_id),
          priority: "MEDIUM",
        });

        if (created) {
          await sendTelegramMessage(
            chatId,
            `Thank you, ${name}! ✅\n\nYour information has been received. One of our counselors will contact you within 24 hours.\n\nIf you have any questions, feel free to ask here.`,
          );
          await logSystemEvent("INFO", "system", `New lead from Telegram: ${name}`, { leadId: lead.id, conversationId });
        } else if (duplicateOf) {
          await sendTelegramMessage(
            chatId,
            `Thanks, ${name}! We already have your information on file. Our team will reach out to you soon. 😊`,
          );
        }

        await setConversationStage(chatId, "COMPLETED", { leadId: lead.id, platformUserId });
        return NextResponse.json({ ok: true });
      }

      if (stage === "COMPLETED") {
        // User is sending a message after lead creation — use AI to answer
        // their question if an AI provider is configured, otherwise fall back
        // to the generic "we'll get back to you" message.
        const aiResponse = await generateAiResponse(text, chatId);

        if (aiResponse) {
          await sendTelegramMessage(chatId, aiResponse);
        } else {
          // No AI provider configured — generic fallback
          await sendTelegramMessage(
            chatId,
            `Thanks for your message! Our team will get back to you soon. If this is urgent, please mention "urgent" in your message.`,
          );
        }
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    await logSystemEvent(
      "ERROR",
      "system",
      `Telegram webhook error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram (they retry on errors)
  }
}

/**
 * GET /api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>
 * Used to verify the webhook is live (for health checks).
 */
export async function GET(req: NextRequest) {
  if (!(await verifySecret(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    bot: (await getTelegramBotToken()) ? "configured" : "not_configured",
  });
}
