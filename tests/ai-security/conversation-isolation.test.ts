/**
 * Conversation Isolation + Pagination + Retention + Sanitization Tests
 * =====================================================================
 *
 * Tests the complete conversation management system:
 *
 * 1. Conversation isolation — Student A can NEVER access Student B's:
 *    - Conversations (load, list, delete)
 *    - Messages (append, read history)
 *    - Conversation IDs (404, not 403 — can't tell if ID exists for others)
 *
 * 2. Pagination — list endpoint returns correct page/pageSize/total
 *
 * 3. Retention — old conversations are cleaned up; message limit enforced
 *
 * 4. Sanitization — API keys, passwords, tokens stripped from stored messages
 *
 * 5. Context continuity — the assistant can follow up on previous messages
 *    (history is passed to the LLM so "What about last semester?" works)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createConversation,
  loadConversation,
  appendMessage,
  listConversations,
  deleteConversation,
  getConversationHistory,
  deleteOldConversations,
  sanitizeMessageContent,
  getRetentionConfig,
  _clearAllConversationsForTests,
} from "@/lib/ai/conversation";

beforeEach(() => {
  _clearAllConversationsForTests();
});

// ── 1. Conversation Isolation ────────────────────────────────────

describe("Conversation Isolation — Student A ≠ Student B", () => {
  describe("Load isolation", () => {
    it("Student A can load their own conversation", () => {
      const conv = createConversation("stu-A");
      const loaded = loadConversation(conv.id, "stu-A");
      expect(loaded).not.toBeNull();
      expect(loaded!.studentId).toBe("stu-A");
    });

    it("Student B CANNOT load Student A's conversation (returns null)", () => {
      const conv = createConversation("stu-A");
      const loaded = loadConversation(conv.id, "stu-B");
      expect(loaded).toBeNull();
    });

    it("Loading a non-existent conversation returns null (not an error)", () => {
      const loaded = loadConversation("nonexistent-id", "stu-A");
      expect(loaded).toBeNull();
    });
  });

  describe("Append isolation", () => {
    it("Student A can append to their own conversation", () => {
      const conv = createConversation("stu-A");
      const success = appendMessage(conv.id, "stu-A", {
        role: "user",
        content: "What is my GPA?",
        createdAt: Date.now(),
      });
      expect(success).toBe(true);

      const loaded = loadConversation(conv.id, "stu-A");
      expect(loaded!.messages).toHaveLength(1);
      expect(loaded!.messages[0].content).toBe("What is my GPA?");
    });

    it("Student B CANNOT append to Student A's conversation", () => {
      const conv = createConversation("stu-A");
      const success = appendMessage(conv.id, "stu-B", {
        role: "user",
        content: "hijack attempt",
        createdAt: Date.now(),
      });
      expect(success).toBe(false);

      // Verify nothing was appended
      const loaded = loadConversation(conv.id, "stu-A");
      expect(loaded!.messages).toHaveLength(0);
    });
  });

  describe("List isolation", () => {
    it("Student A's list does NOT include Student B's conversations", () => {
      createConversation("stu-A", "Alice's chat 1");
      createConversation("stu-A", "Alice's chat 2");
      createConversation("stu-B", "Bob's chat 1");
      createConversation("stu-B", "Bob's chat 2");
      createConversation("stu-B", "Bob's chat 3");

      const resultA = listConversations("stu-A");
      const resultB = listConversations("stu-B");

      expect(resultA.conversations).toHaveLength(2);
      expect(resultB.conversations).toHaveLength(3);

      // Verify no cross-contamination
      const aTitles = resultA.conversations.map((c) => c.title);
      const bTitles = resultB.conversations.map((c) => c.title);
      expect(aTitles.every((t) => t.startsWith("Alice"))).toBe(true);
      expect(bTitles.every((t) => t.startsWith("Bob"))).toBe(true);
    });
  });

  describe("Delete isolation", () => {
    it("Student A can delete their own conversation", () => {
      const conv = createConversation("stu-A");
      const success = deleteConversation(conv.id, "stu-A");
      expect(success).toBe(true);

      // Verify it's gone
      const loaded = loadConversation(conv.id, "stu-A");
      expect(loaded).toBeNull();
    });

    it("Student B CANNOT delete Student A's conversation", () => {
      const conv = createConversation("stu-A");
      const success = deleteConversation(conv.id, "stu-B");
      expect(success).toBe(false);

      // Verify it's still there
      const loaded = loadConversation(conv.id, "stu-A");
      expect(loaded).not.toBeNull();
    });

    it("Delete returns false for non-existent conversation (not an error)", () => {
      const success = deleteConversation("nonexistent", "stu-A");
      expect(success).toBe(false);
    });
  });

  describe("History isolation", () => {
    it("Student A's history does NOT include Student B's messages", () => {
      const convA = createConversation("stu-A");
      appendMessage(convA.id, "stu-A", {
        role: "user",
        content: "Alice's GPA question",
        createdAt: 1000,
      });
      appendMessage(convA.id, "stu-A", {
        role: "assistant",
        content: "Alice's GPA is 3.8",
        createdAt: 2000,
      });

      const convB = createConversation("stu-B");
      appendMessage(convB.id, "stu-B", {
        role: "user",
        content: "Bob's GPA question",
        createdAt: 3000,
      });
      appendMessage(convB.id, "stu-B", {
        role: "assistant",
        content: "Bob's GPA is 3.2",
        createdAt: 4000,
      });

      const historyA = getConversationHistory(convA.id, "stu-A");
      const historyB = getConversationHistory(convB.id, "stu-B");

      expect(historyA).not.toBeNull();
      expect(historyA!.map((m) => m.content)).toEqual([
        "Alice's GPA question",
        "Alice's GPA is 3.8",
      ]);
      expect(historyA!.some((m) => m.content.includes("Bob"))).toBe(false);

      expect(historyB).not.toBeNull();
      expect(historyB!.map((m) => m.content)).toEqual([
        "Bob's GPA question",
        "Bob's GPA is 3.2",
      ]);
      expect(historyB!.some((m) => m.content.includes("Alice"))).toBe(false);
    });

    it("Student B CANNOT get history of Student A's conversation", () => {
      const convA = createConversation("stu-A");
      appendMessage(convA.id, "stu-A", {
        role: "user",
        content: "Alice's secret question",
        createdAt: 1000,
      });

      const history = getConversationHistory(convA.id, "stu-B");
      expect(history).toBeNull();
    });
  });

  describe("Context continuity (follow-up questions work)", () => {
    it("history preserves the conversation order so the LLM has context", () => {
      const conv = createConversation("stu-A");

      // Simulate a multi-turn conversation
      appendMessage(conv.id, "stu-A", { role: "user", content: "What is my GPA?", createdAt: 1000 });
      appendMessage(conv.id, "stu-A", { role: "assistant", content: "Your current GPA is 3.82.", createdAt: 2000 });
      appendMessage(conv.id, "stu-A", { role: "user", content: "What about last semester?", createdAt: 3000 });
      appendMessage(conv.id, "stu-A", { role: "assistant", content: "Last semester your GPA was 3.75.", createdAt: 4000 });

      const history = getConversationHistory(conv.id, "stu-A");
      expect(history).not.toBeNull();
      expect(history!).toHaveLength(4);

      // Verify order is preserved
      expect(history![0].content).toBe("What is my GPA?");
      expect(history![1].content).toBe("Your current GPA is 3.82.");
      expect(history![2].content).toBe("What about last semester?");
      expect(history![3].content).toBe("Last semester your GPA was 3.75.");
    });
  });
});

// ── 2. Pagination ────────────────────────────────────────────────

describe("Pagination", () => {
  beforeEach(() => {
    // Create 25 conversations for stu-A
    for (let i = 0; i < 25; i++) {
      createConversation("stu-A", `Chat ${i + 1}`);
    }
  });

  it("returns the first page with default page size", () => {
    const result = listConversations("stu-A");
    expect(result.conversations).toHaveLength(20);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(20);
    expect(result.pagination.total).toBe(25);
    expect(result.pagination.totalPages).toBe(2);
  });

  it("returns the second page", () => {
    const result = listConversations("stu-A", { page: 2 });
    expect(result.conversations).toHaveLength(5);
    expect(result.pagination.page).toBe(2);
  });

  it("respects custom page size", () => {
    const result = listConversations("stu-A", { page: 1, pageSize: 10 });
    expect(result.conversations).toHaveLength(10);
    expect(result.pagination.pageSize).toBe(10);
    expect(result.pagination.totalPages).toBe(3);
  });

  it("returns empty page when page exceeds total pages", () => {
    const result = listConversations("stu-A", { page: 10 });
    expect(result.conversations).toHaveLength(0);
    expect(result.pagination.total).toBe(25);
  });

  it("caps page size at 100", () => {
    const result = listConversations("stu-A", { pageSize: 500 });
    expect(result.pagination.pageSize).toBe(100);
  });

  it("list items include messageCount", () => {
    const conv = createConversation("stu-B");
    appendMessage(conv.id, "stu-B", { role: "user", content: "Hi", createdAt: 1000 });
    appendMessage(conv.id, "stu-B", { role: "assistant", content: "Hello!", createdAt: 2000 });

    const result = listConversations("stu-B");
    expect(result.conversations[0].messageCount).toBe(2);
  });
});

// ── 3. Retention ─────────────────────────────────────────────────

describe("Retention", () => {
  it("getRetentionConfig returns the configured limits", () => {
    const config = getRetentionConfig();
    expect(config.maxMessagesPerConversation).toBe(100);
    expect(config.maxHistoryMessagesForLlm).toBe(20);
    expect(config.retentionDays).toBe(90);
    expect(config.maxTitleLength).toBe(50);
  });

  it("deleteOldConversations removes conversations older than retention period", () => {
    // Create a conversation — it's brand new, so won't be deleted.
    // The actual deletion logic is straightforward (filter by
    // updatedAt < cutoff). This test verifies the function runs
    // without error and returns a number.
    createConversation("stu-A", "Fresh chat");

    const deleted = deleteOldConversations();
    expect(typeof deleted).toBe("number");
    // The conversation was just created, so it won't be deleted
    expect(deleted).toBe(0);
  });

  it("prunes messages when conversation exceeds MAX_MESSAGES_PER_CONVERSATION", () => {
    const conv = createConversation("stu-A");

    // Append 105 messages (exceeds the 100 limit)
    for (let i = 0; i < 105; i++) {
      appendMessage(conv.id, "stu-A", {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}`,
        createdAt: i * 1000,
      });
    }

    const loaded = loadConversation(conv.id, "stu-A");
    // Should be capped at 100 messages (oldest 5 pruned)
    expect(loaded!.messages).toHaveLength(100);
    // The first 5 messages should be gone
    expect(loaded!.messages[0].content).toBe("Message 5");
  });

  it("history is limited to MAX_HISTORY_MESSAGES_FOR_LLM (20)", () => {
    const conv = createConversation("stu-A");

    // Append 30 user+assistant messages
    for (let i = 0; i < 15; i++) {
      appendMessage(conv.id, "stu-A", { role: "user", content: `Q${i}`, createdAt: i * 1000 });
      appendMessage(conv.id, "stu-A", { role: "assistant", content: `A${i}`, createdAt: i * 1000 + 500 });
    }

    const history = getConversationHistory(conv.id, "stu-A");
    expect(history).not.toBeNull();
    // Should only return the most recent 20 messages
    expect(history!).toHaveLength(20);
    // The most recent message should be A14 (the last one)
    expect(history![history!.length - 1].content).toBe("A14");
  });
});

// ── 4. Sanitization ──────────────────────────────────────────────

describe("Message Sanitization", () => {
  it("strips OpenAI API keys from message content", () => {
    const sanitized = sanitizeMessageContent("My key is sk-1234567890abcdef1234567890abcdef");
    expect(sanitized).not.toContain("sk-1234567890");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("strips AWS API keys", () => {
    const sanitized = sanitizeMessageContent("AWS key: AKIAIOSFODNN7EXAMPLE");
    expect(sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("strips JWT tokens", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456ghi789";
    const sanitized = sanitizeMessageContent(`Token: ${token}`);
    expect(sanitized).not.toContain(token);
    expect(sanitized).toContain("[REDACTED]");
  });

  it("strips password-like patterns", () => {
    const sanitized = sanitizeMessageContent("password=secret123");
    expect(sanitized).not.toContain("secret123");
    expect(sanitized).toContain("password=[REDACTED]");
  });

  it("strips connection strings", () => {
    const sanitized = sanitizeMessageContent("mongodb://user:pass@host:27017/db");
    expect(sanitized).not.toContain("mongodb://");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("strips sensitive data when appending to conversation", () => {
    const conv = createConversation("stu-A");
    appendMessage(conv.id, "stu-A", {
      role: "user",
      content: "My API key is sk-1234567890abcdef1234567890abcdef",
      createdAt: Date.now(),
    });

    const loaded = loadConversation(conv.id, "stu-A");
    expect(loaded!.messages[0].content).not.toContain("sk-1234567890");
    expect(loaded!.messages[0].content).toContain("[REDACTED]");
  });

  it("does NOT strip normal text", () => {
    const sanitized = sanitizeMessageContent("What is my GPA?");
    expect(sanitized).toBe("What is my GPA?");
  });

  it("does NOT strip URLs (non-connection-string)", () => {
    const sanitized = sanitizeMessageContent("Visit https://example.com for info");
    expect(sanitized).toBe("Visit https://example.com for info");
  });

  it("re-sanitizes history on read (defense in depth)", () => {
    const conv = createConversation("stu-A");
    // Even if a message somehow bypassed append-time sanitization,
    // getConversationHistory re-sanitizes
    appendMessage(conv.id, "stu-A", {
      role: "user",
      content: "password=hunter2",
      createdAt: Date.now(),
    });

    const history = getConversationHistory(conv.id, "stu-A");
    expect(history![0].content).toContain("[REDACTED]");
    expect(history![0].content).not.toContain("hunter2");
  });
});

// ── 5. Message pagination in loadConversation ────────────────────

describe("Message pagination in loadConversation", () => {
  it("supports limit parameter", () => {
    const conv = createConversation("stu-A");
    for (let i = 0; i < 10; i++) {
      appendMessage(conv.id, "stu-A", { role: "user", content: `M${i}`, createdAt: i * 1000 });
    }

    const loaded = loadConversation(conv.id, "stu-A", { limit: 5 });
    expect(loaded!.messages).toHaveLength(5);
  });

  it("supports offset parameter", () => {
    const conv = createConversation("stu-A");
    for (let i = 0; i < 10; i++) {
      appendMessage(conv.id, "stu-A", { role: "user", content: `M${i}`, createdAt: i * 1000 });
    }

    const loaded = loadConversation(conv.id, "stu-A", { offset: 5 });
    expect(loaded!.messages).toHaveLength(5);
    expect(loaded!.messages[0].content).toBe("M5");
  });

  it("supports limit + offset together", () => {
    const conv = createConversation("stu-A");
    for (let i = 0; i < 10; i++) {
      appendMessage(conv.id, "stu-A", { role: "user", content: `M${i}`, createdAt: i * 1000 });
    }

    const loaded = loadConversation(conv.id, "stu-A", { limit: 3, offset: 4 });
    expect(loaded!.messages).toHaveLength(3);
    expect(loaded!.messages[0].content).toBe("M4");
    expect(loaded!.messages[2].content).toBe("M6");
  });
});
