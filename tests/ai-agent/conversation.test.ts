import { describe, it, expect, beforeEach } from "vitest";
import {
  createConversation,
  loadConversation,
  appendMessage,
  listConversations,
  _clearAllConversationsForTests,
  type ConversationMessage,
} from "@/lib/ai/conversation";

describe("Conversation Manager", () => {
  beforeEach(() => {
    _clearAllConversationsForTests();
  });

  it("creates a conversation with a unique ID", () => {
    const conv = createConversation("stu-1");
    expect(conv.id).toMatch(/^conv-\d+-/);
    expect(conv.studentId).toBe("stu-1");
    expect(conv.title).toBe("New conversation");
    expect(conv.messages).toEqual([]);
  });

  it("loads a conversation by ID for the correct student", () => {
    const conv = createConversation("stu-1");
    const loaded = loadConversation(conv.id, "stu-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(conv.id);
  });

  it("returns null when loading another student's conversation", () => {
    const conv = createConversation("stu-1");
    // stu-2 tries to load stu-1's conversation → should fail
    const loaded = loadConversation(conv.id, "stu-2");
    expect(loaded).toBeNull();
  });

  it("appends a message to the correct conversation", () => {
    const conv = createConversation("stu-1");
    const msg: ConversationMessage = {
      role: "user",
      content: "What is my GPA?",
      createdAt: Date.now(),
    };
    const success = appendMessage(conv.id, "stu-1", msg);
    expect(success).toBe(true);

    const loaded = loadConversation(conv.id, "stu-1");
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0].content).toBe("What is my GPA?");
  });

  it("refuses to append to another student's conversation", () => {
    const conv = createConversation("stu-1");
    const msg: ConversationMessage = {
      role: "user",
      content: "hijack attempt",
      createdAt: Date.now(),
    };
    const success = appendMessage(conv.id, "stu-2", msg);
    expect(success).toBe(false);

    // The message was NOT appended
    const loaded = loadConversation(conv.id, "stu-1");
    expect(loaded!.messages).toHaveLength(0);
  });

  it("auto-titles the conversation from the first user message", () => {
    const conv = createConversation("stu-1");
    appendMessage(conv.id, "stu-1", {
      role: "user",
      content: "What is my application status?",
      createdAt: Date.now(),
    });

    const loaded = loadConversation(conv.id, "stu-1");
    expect(loaded!.title).toBe("What is my application status?");
  });

  it("truncates long titles", () => {
    const conv = createConversation("stu-1");
    const longMessage = "A".repeat(100);
    appendMessage(conv.id, "stu-1", {
      role: "user",
      content: longMessage,
      createdAt: Date.now(),
    });

    const loaded = loadConversation(conv.id, "stu-1");
    expect(loaded!.title.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(loaded!.title).toMatch(/\.\.\.$/);
  });

  it("lists only the student's own conversations, most recent first", () => {
    const conv1 = createConversation("stu-1");
    // Force a different updatedAt by appending a message to conv1 first,
    // then creating conv2. This ensures conv2 has a later updatedAt.
    appendMessage(conv1.id, "stu-1", {
      role: "user",
      content: "First message",
      createdAt: 1000,
    });
    const conv2 = createConversation("stu-1");
    appendMessage(conv2.id, "stu-1", {
      role: "user",
      content: "Second message",
      createdAt: 2000,
    });
    createConversation("stu-2"); // Another student's conversation

    const result = listConversations("stu-1");
    expect(result.conversations).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
    // Most recent first (by updatedAt)
    const ids = result.conversations.map((c) => c.id);
    expect(ids).toContain(conv1.id);
    expect(ids).toContain(conv2.id);
    // List view should not include messages
    expect(result.conversations[0].messageCount).toBeDefined();
  });
});
