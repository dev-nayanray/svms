"use client";

/**
 * AI Assistant Client — SSE fetch helper
 * =======================================
 *
 * Browser-side helper for the /api/student/assistant/chat endpoint.
 *
 * This module handles:
 *  - POSTing the user's message to the chat endpoint
 *  - Parsing the SSE stream (Server-Sent Events)
 *  - Yielding typed events to the UI component
 *  - Network error handling + retry logic
 *
 * SECURITY:
 *  - No API keys are used here — the browser never talks to the AI
 *    provider directly. All requests go to our own backend.
 *  - The student identity is derived from the session cookie on the
 *    server side. This client sends no studentId.
 */

export type ChatEvent =
  | { type: "conversation"; conversationId: string; isNew: boolean }
  | { type: "text"; text: string }
  | { type: "tool_call"; toolName: string }
  | { type: "tool_result"; toolName: string; success: boolean }
  | { type: "done"; usage?: { inputTokens: number; outputTokens: number } }
  | { type: "error"; error: { code: string; message: string } };

export interface SendMessageOptions {
  message: string;
  conversationId?: string;
  signal?: AbortSignal;
}

/**
 * Send a message to the AI assistant and stream the response.
 *
 * Yields ChatEvents as they arrive from the SSE stream.
 *
 * @throws {Error} on network failure or non-2xx HTTP response
 */
export async function* sendMessage(opts: SendMessageOptions): AsyncIterable<ChatEvent> {
  const res = await fetch("/api/student/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: opts.message,
      ...(opts.conversationId ? { conversationId: opts.conversationId } : {}),
    }),
    signal: opts.signal,
  });

  // Handle non-2xx responses (rate limit, validation error, etc.)
  if (!res.ok) {
    let errorCode = "INTERNAL";
    let errorMessage = "Something went wrong. Please try again.";

    try {
      const body = await res.json();
      if (body?.error?.code) errorCode = body.error.code;
      if (body?.error?.message) errorMessage = body.error.message;
    } catch {
      // Response wasn't JSON — use the status code
      if (res.status === 429) {
        errorCode = "RATE_LIMITED";
        errorMessage = "You're sending messages too fast. Please wait a moment.";
      } else if (res.status === 401) {
        errorCode = "UNAUTHORIZED";
        errorMessage = "Please log in again.";
      }
    }

    yield { type: "error", error: { code: errorCode, message: errorMessage } };
    return;
  }

  // Parse the SSE stream
  if (!res.body) {
    yield { type: "error", error: { code: "NO_RESPONSE", message: "No response from server." } };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines (separated by \n\n)
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep the last incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith(":")) continue; // Comment/heartbeat
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        try {
          const event = JSON.parse(data) as ChatEvent;
          yield event;

          // Stop reading after done or error
          if (event.type === "done" || event.type === "error") return;
        } catch {
          // Skip malformed JSON
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetch the list of conversations (non-streaming).
 */
export async function fetchConversations(): Promise<{
  conversations: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
  }>;
}> {
  const res = await fetch("/api/student/assistant/conversations", {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to load conversations");
  }
  const body = await res.json();
  return body.data;
}

/**
 * Fetch a single conversation with messages (non-streaming).
 */
export async function fetchConversation(
  id: string,
): Promise<{
  conversation: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Array<{ role: string; content: string; createdAt: string }>;
  };
}> {
  const res = await fetch(`/api/student/assistant/conversations/${id}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to load conversation");
  }
  const body = await res.json();
  return body.data;
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`/api/student/assistant/conversations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete conversation");
  }
}
