/**
 * AI Conversation Manager
 * ========================
 *
 * Manages conversation lifecycle: create, load history, persist
 * messages.
 *
 * Since the AiConversation + AiMessage Prisma models aren't added
 * yet (Phase 0 schema extension), this module uses an in-memory
 * store. When the models are added, swap the implementation — the
 * function signatures stay the same.
 *
 * SECURITY:
 *  - All queries are scoped by studentId (from the session).
 *  - A student can only load/persist their own conversations.
 *  - Messages are stored with the conversation's studentId — never
 *    cross-contaminated.
 */

import "server-only";

export interface ConversationMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; name: string; args: string }>;
  createdAt: number; // epoch ms
}

export interface Conversation {
  id: string;
  studentId: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
}

// ── In-memory store (Phase 0 will replace with Prisma) ───────────

interface StoredConversation extends Conversation {
  messages: ConversationMessage[];
}

const store = new Map<string, StoredConversation>();

/**
 * Create a new conversation for a student.
 */
export function createConversation(studentId: string, title = "New conversation"): Conversation {
  const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const conv: StoredConversation = {
    id,
    studentId,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  store.set(id, conv);
  return { ...conv, messages: [...conv.messages] };
}

/**
 * Load a conversation by ID.
 *
 * SECURITY: Returns null if the conversation doesn't belong to the
 * given studentId. This prevents cross-student access.
 */
export function loadConversation(conversationId: string, studentId: string): Conversation | null {
  const conv = store.get(conversationId);
  if (!conv || conv.studentId !== studentId) return null;
  return { ...conv, messages: [...conv.messages] };
}

/**
 * Append a message to a conversation.
 *
 * SECURITY: Verifies the conversation belongs to the studentId
 * before appending. Returns false if the conversation doesn't exist
 * or doesn't belong to the student.
 */
export function appendMessage(
  conversationId: string,
  studentId: string,
  message: ConversationMessage,
): boolean {
  const conv = store.get(conversationId);
  if (!conv || conv.studentId !== studentId) return false;
  conv.messages.push(message);
  conv.updatedAt = Date.now();

  // Auto-title from first user message
  if (conv.title === "New conversation" && message.role === "user") {
    conv.title = message.content.slice(0, 50) + (message.content.length > 50 ? "..." : "");
  }

  return true;
}

/**
 * List a student's conversations (most recent first).
 */
export function listConversations(studentId: string): Conversation[] {
  const convs = Array.from(store.values())
    .filter((c) => c.studentId === studentId)
    .map((c) => ({ ...c, messages: [] })) // Don't return messages in list view
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return convs;
}

/**
 * Clear all conversations (for tests).
 */
export function _clearAllConversationsForTests(): void {
  store.clear();
}
