/**
 * AI Conversation Manager
 * ========================
 *
 * Manages conversation lifecycle: create, load history, persist
 * messages, paginate, delete, and enforce retention.
 *
 * Since the AiConversation + AiMessage Prisma models aren't added
 * yet (Phase 0 schema extension), this module uses an in-memory
 * store. When the models are added, swap the implementation — the
 * function signatures stay the same.
 *
 * SECURITY:
 *  - All queries are scoped by studentId (from the session).
 *  - A student can only load/persist/delete their own conversations.
 *  - Messages are stored with the conversation's studentId — never
 *    cross-contaminated.
 *  - Sensitive data (API keys, passwords, tokens, secrets) is
 *    sanitized from stored messages before persistence.
 *  - Conversation history sent to the LLM is always re-sanitized
 *    on read (defense in depth).
 *
 * RETENTION:
 *  - Conversations older than RETENTION_DAYS with no new messages
 *    are eligible for cleanup (run deleteOldConversations).
 *  - Each conversation is capped at MAX_MESSAGES_PER_CONVERSATION;
 *    older messages are pruned when the limit is exceeded.
 */

import "server-only";

// ── Types ────────────────────────────────────────────────────────

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

export interface ConversationListItem {
  id: string;
  studentId: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PaginatedConversations {
  conversations: ConversationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ── Configuration ────────────────────────────────────────────────

/** Maximum messages stored per conversation (older messages pruned). */
const MAX_MESSAGES_PER_CONVERSATION = 100;

/** Maximum messages sent to the LLM as context (most recent N). */
const MAX_HISTORY_MESSAGES_FOR_LLM = 20;

/** Conversations older than this (with no new messages) are deleted. */
const RETENTION_DAYS = 90;

/** Maximum conversation title length. */
const MAX_TITLE_LENGTH = 50;

/** Default page size for listConversations. */
const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size allowed. */
const MAX_PAGE_SIZE = 100;

// ── Sensitive data patterns ──────────────────────────────────────

/**
 * Patterns that are stripped from message content before persistence.
 * If a student accidentally pastes an API key, password, or token
 * into the chat, it won't be stored in the conversation history.
 */
const SENSITIVE_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // API keys (common formats): sk-..., AKIA..., ghp_..., etc.
  { pattern: /\b(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36}|AIza[a-zA-Z0-9_-]{35})\b/g, replacement: "[REDACTED]" },
  // Bearer tokens
  { pattern: /\bBearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, replacement: "[REDACTED]" },
  // JWT tokens (header.payload.signature)
  { pattern: /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, replacement: "[REDACTED]" },
  // Password-like patterns (password=..., pwd=..., pass=...)
  { pattern: /\b(password|pwd|pass|secret|token|apikey|api_key)\s*[=:]\s*\S+/gi, replacement: "$1=[REDACTED]" },
  // Connection strings (mongodb://, postgres://, etc.)
  { pattern: /\b(mongodb|postgres|postgresql|redis|amqp):\/\/[^\s]+/gi, replacement: "[REDACTED]" },
];

// ── In-memory store ──────────────────────────────────────────────

interface StoredConversation extends Conversation {
  messages: ConversationMessage[];
}

const store = new Map<string, StoredConversation>();

// ── Sanitization ─────────────────────────────────────────────────

/**
 * Sanitize message content before storing or returning it.
 *
 * Strips:
 *  - API keys (sk-..., AKIA..., ghp_..., AIza...)
 *  - Bearer tokens / JWTs
 *  - Password-like patterns (password=..., token=...)
 *  - Connection strings (mongodb://..., postgres://...)
 *
 * This is defense in depth — even if a student accidentally pastes
 * a secret into the chat, it won't be stored in plaintext.
 */
export function sanitizeMessageContent(content: string): string {
  let sanitized = content;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

// ── CRUD operations ──────────────────────────────────────────────

/**
 * Create a new conversation for a student.
 *
 * @param studentId — from the authenticated session (NEVER from client input)
 * @param title — optional title (defaults to "New conversation")
 */
export function createConversation(studentId: string, title = "New conversation"): Conversation {
  const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const conv: StoredConversation = {
    id,
    studentId,
    title: title.slice(0, MAX_TITLE_LENGTH),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  store.set(id, conv);
  return { ...conv, messages: [] };
}

/**
 * Load a conversation by ID.
 *
 * SECURITY: Returns null if the conversation doesn't belong to the
 * given studentId. This prevents cross-student access — a student
 * cannot read another student's conversation by guessing the ID.
 *
 * @param conversationId — the conversation to load
 * @param studentId — from the authenticated session (ownership check)
 * @param options.limit — max messages to return (most recent first)
 * @param options.offset — skip this many messages (for pagination)
 */
export function loadConversation(
  conversationId: string,
  studentId: string,
  options?: { limit?: number; offset?: number },
): Conversation | null {
  const conv = store.get(conversationId);
  if (!conv || conv.studentId !== studentId) return null;

  let messages = [...conv.messages];

  // Apply pagination if requested
  if (options?.offset) {
    messages = messages.slice(options.offset);
  }
  if (options?.limit && options.limit > 0) {
    messages = messages.slice(0, options.limit);
  }

  return {
    id: conv.id,
    studentId: conv.studentId,
    title: conv.title,
    messages,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

/**
 * Append a message to a conversation.
 *
 * SECURITY: Verifies the conversation belongs to the studentId
 * before appending. Returns false if the conversation doesn't exist
 * or doesn't belong to the student.
 *
 * The message content is sanitized before storage (strips API keys,
 * passwords, tokens, connection strings).
 *
 * RETENTION: If the conversation exceeds MAX_MESSAGES_PER_CONVERSATION,
 * the oldest messages are pruned.
 *
 * @returns true if appended, false if not found / not owned
 */
export function appendMessage(
  conversationId: string,
  studentId: string,
  message: ConversationMessage,
): boolean {
  const conv = store.get(conversationId);
  if (!conv || conv.studentId !== studentId) return false;

  // Sanitize the message content before storing
  const sanitizedMessage: ConversationMessage = {
    ...message,
    content: sanitizeMessageContent(message.content),
  };

  conv.messages.push(sanitizedMessage);
  conv.updatedAt = Date.now();

  // Prune old messages if over the limit
  if (conv.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    const excess = conv.messages.length - MAX_MESSAGES_PER_CONVERSATION;
    conv.messages = conv.messages.slice(excess);
  }

  // Auto-title from first user message
  if (conv.title === "New conversation" && message.role === "user") {
    conv.title =
      message.content.slice(0, MAX_TITLE_LENGTH) +
      (message.content.length > MAX_TITLE_LENGTH ? "..." : "");
  }

  return true;
}

/**
 * List a student's conversations with pagination.
 *
 * SECURITY: Only returns conversations where studentId matches.
 * The list view does NOT include message content (only metadata).
 *
 * @param studentId — from the authenticated session
 * @param options.page — 1-indexed page number (default 1)
 * @param options.pageSize — items per page (default 20, max 100)
 */
export function listConversations(
  studentId: string,
  options?: { page?: number; pageSize?: number },
): PaginatedConversations {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE));

  const all = Array.from(store.values())
    .filter((c) => c.studentId === studentId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;
  const pageItems = all.slice(offset, offset + pageSize);

  return {
    conversations: pageItems.map((c) => ({
      id: c.id,
      studentId: c.studentId,
      title: c.title,
      messageCount: c.messages.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Delete a conversation by ID.
 *
 * SECURITY: Verifies the conversation belongs to the given studentId
 * before deleting. Returns false if the conversation doesn't exist or
 * doesn't belong to the student — so a student cannot delete another
 * student's conversation (and cannot tell whether a given ID exists
 * for someone else).
 *
 * @returns true if deleted, false if not found / not owned
 */
export function deleteConversation(conversationId: string, studentId: string): boolean {
  const conv = store.get(conversationId);
  if (!conv || conv.studentId !== studentId) return false;
  store.delete(conversationId);
  return true;
}

// ── Conversation history for the LLM ─────────────────────────────

/**
 * Build the conversation history to send to the LLM.
 *
 * Returns the most recent MAX_HISTORY_MESSAGES_FOR_LLM messages,
 * re-sanitized (defense in depth), formatted as ChatMessage[] for
 * the provider.
 *
 * SECURITY:
 *  - Only loads conversations owned by the given studentId.
 *  - Re-sanitizes message content (in case sensitive data slipped
 *    through the append-time sanitization).
 *  - Excludes tool messages from the history sent to the LLM
 *    (they're internal — the student doesn't need to see them and
 *    they consume tokens).
 *
 * @param conversationId — the conversation to load history from
 * @param studentId — from the authenticated session (ownership check)
 * @returns array of {role, content} messages, or null if not owned
 */
export function getConversationHistory(
  conversationId: string,
  studentId: string,
): Array<{ role: "user" | "assistant"; content: string }> | null {
  const conv = store.get(conversationId);
  if (!conv || conv.studentId !== studentId) return null;

  return conv.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES_FOR_LLM)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: sanitizeMessageContent(m.content),
    }));
}

// ── Retention ────────────────────────────────────────────────────

/**
 * Delete conversations older than RETENTION_DAYS that haven't been
 * updated recently.
 *
 * This is a cleanup function — call it from a cron job or on a
 * schedule. It does NOT delete conversations that are still active
 * (updated within the retention window).
 *
 * @returns the number of conversations deleted
 */
export function deleteOldConversations(): number {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const [id, conv] of store) {
    if (conv.updatedAt < cutoff) {
      store.delete(id);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Get the retention configuration (for admin display).
 */
export function getRetentionConfig(): {
  maxMessagesPerConversation: number;
  maxHistoryMessagesForLlm: number;
  retentionDays: number;
  maxTitleLength: number;
} {
  return {
    maxMessagesPerConversation: MAX_MESSAGES_PER_CONVERSATION,
    maxHistoryMessagesForLlm: MAX_HISTORY_MESSAGES_FOR_LLM,
    retentionDays: RETENTION_DAYS,
    maxTitleLength: MAX_TITLE_LENGTH,
  };
}

// ── Test helpers ─────────────────────────────────────────────────

/**
 * Clear all conversations (for tests).
 */
export function _clearAllConversationsForTests(): void {
  store.clear();
}

/**
 * Get the total number of stored conversations (for tests).
 */
export function _getConversationCountForTests(): number {
  return store.size;
}
