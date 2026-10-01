import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────
//
// We mock the auth guard, the AI provider, the context builder, and
// the conversation store. This isolates the API route tests from
// the database + the real LLM provider.

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockStudentPreferenceFindUnique = vi.fn();
const mockApplicationFindFirst = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (...a: unknown[]) => mockStudentFindFirst(...a) },
    studentPreference: { findUnique: (...a: unknown[]) => mockStudentPreferenceFindUnique(...a) },
    application: { findFirst: (...a: unknown[]) => mockApplicationFindFirst(...a) },
  },
}));

// Mock the AI provider so no real API calls are made
const mockProviderStreamChat = vi.fn();
vi.mock("@/lib/ai/provider", () => ({
  getAiProvider: () => ({
    streamChat: (...a: unknown[]) => mockProviderStreamChat(...a),
    countTokens: () => 100,
  }),
}));

import { POST as chatPOST } from "@/app/api/student/assistant/chat/route";
import { GET as conversationsGET } from "@/app/api/student/assistant/conversations/route";
import {
  GET as conversationGET,
  DELETE as conversationDELETE,
} from "@/app/api/student/assistant/conversations/[id]/route";
import {
  _clearAllConversationsForTests,
  createConversation,
  appendMessage,
} from "@/lib/ai/conversation";
import { _resetApiRateLimitForTests } from "@/lib/ai/api-rate-limit";

// ── Fixtures ─────────────────────────────────────────────────────

const baseStudent = {
  id: "stu-1",
  userId: "user-1",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  email: "k@x.com",
  deletedAt: null,
};

function makeSession(role = "STUDENT") {
  return {
    user: {
      id: "user-1",
      role,
      name: "Karim",
      email: "k@x.com",
    },
  };
}

function makeRequest(body: unknown, method = "POST") {
  return new NextRequest("http://localhost/api/student/assistant/chat", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  _clearAllConversationsForTests();
  _resetApiRateLimitForTests();

  // Default: authenticated student
  mockAuth.mockResolvedValue(makeSession());
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockStudentPreferenceFindUnique.mockResolvedValue({ language: "en" });
  mockApplicationFindFirst.mockResolvedValue(null);

  // Default: provider returns a simple text response
  mockProviderStreamChat.mockImplementation(async function* () {
    yield { type: "text", text: "Hello!" };
    yield { type: "done", usage: { inputTokens: 10, outputTokens: 1 }, finishReason: "stop" };
  });
});

// ── Tests ────────────────────────────────────────────────────────

describe("POST /api/student/assistant/chat", () => {
  it("rejects unauthenticated requests (401)", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await chatPOST(makeRequest({ message: "Hello" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects non-STUDENT roles (403)", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN"));

    const res = await chatPOST(makeRequest({ message: "Hello" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects empty messages (422)", async () => {
    const res = await chatPOST(makeRequest({ message: "" }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects messages over 2000 chars (422)", async () => {
    const res = await chatPOST(makeRequest({ message: "x".repeat(2001) }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid JSON body (400)", async () => {
    const req = new NextRequest("http://localhost/api/student/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await chatPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("returns SSE stream with conversation event first", async () => {
    const res = await chatPOST(makeRequest({ message: "Hi" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // Read the stream
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));

    // First event should be the conversation event
    const firstEvent = JSON.parse(lines[0].slice(6));
    expect(firstEvent.type).toBe("conversation");
    expect(firstEvent.conversationId).toMatch(/^conv-/);
    expect(firstEvent.isNew).toBe(true);
  });

  it("streams text chunks from the AI", async () => {
    const res = await chatPOST(makeRequest({ message: "Hi" }));
    const text = await res.text();
    const events = text
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => JSON.parse(l.slice(6)));

    const textEvents = events.filter((e: { type: string }) => e.type === "text");
    expect(textEvents).toHaveLength(1);
    expect((textEvents[0] as { text: string }).text).toBe("Hello!");

    const doneEvent = events.find((e: { type: string }) => e.type === "done");
    expect(doneEvent).toBeDefined();
  });

  it("creates a new conversation when no conversationId is provided", async () => {
    const res = await chatPOST(makeRequest({ message: "Hi" }));
    const text = await res.text();
    const firstEvent = JSON.parse(
      text.split("\n").find((l) => l.startsWith("data: "))!.slice(6),
    );
    expect(firstEvent.isNew).toBe(true);
  });

  it("reuses existing conversation when conversationId is provided", async () => {
    const existing = createConversation("stu-1", "Test conversation");

    const res = await chatPOST(
      makeRequest({ message: "Follow up", conversationId: existing.id }),
    );
    const text = await res.text();
    const firstEvent = JSON.parse(
      text.split("\n").find((l) => l.startsWith("data: "))!.slice(6),
    );

    expect(firstEvent.conversationId).toBe(existing.id);
    expect(firstEvent.isNew).toBe(false);
  });

  it("does NOT reuse another student's conversation (IDOR-safe)", async () => {
    // stu-2 creates a conversation
    const otherConv = createConversation("stu-2", "Someone else's chat");

    // stu-1 tries to use it
    const res = await chatPOST(
      makeRequest({ message: "Hi", conversationId: otherConv.id }),
    );
    const text = await res.text();
    const firstEvent = JSON.parse(
      text.split("\n").find((l) => l.startsWith("data: "))!.slice(6),
    );

    // A NEW conversation should be created (not the other student's)
    expect(firstEvent.conversationId).not.toBe(otherConv.id);
    expect(firstEvent.isNew).toBe(true);
  });

  it("respects the global kill switch (503)", async () => {
    const original = process.env.AI_ASSISTANT_ENABLED;
    process.env.AI_ASSISTANT_ENABLED = "false";

    const res = await chatPOST(makeRequest({ message: "Hi" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe("UNAVAILABLE");

    process.env.AI_ASSISTANT_ENABLED = original;
  });

  it("rate-limits after 5 messages in a minute (429)", async () => {
    // Send 5 messages (the burst limit)
    for (let i = 0; i < 5; i++) {
      await chatPOST(makeRequest({ message: `Message ${i}` }));
    }

    // 6th should be rate-limited
    const res = await chatPOST(makeRequest({ message: "One more" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.retryAfter).toBeGreaterThan(0);
  });

  it("includes X-Request-Id header in SSE response", async () => {
    const res = await chatPOST(makeRequest({ message: "Hi" }));
    expect(res.headers.get("X-Request-Id")).toMatch(/^req-|^[0-9a-f-]{36}$/);
  });
});

// ─────────────────────────────────────────────────────────────────

describe("GET /api/student/assistant/conversations", () => {
  it("rejects unauthenticated requests (401)", async () => {
    mockAuth.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/student/assistant/conversations");
    const res = await conversationsGET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the student's conversations list", async () => {
    // Create some conversations for stu-1
    const conv1 = createConversation("stu-1", "First chat");
    appendMessage(conv1.id, "stu-1", {
      role: "user",
      content: "Hello",
      createdAt: 1000,
    });
    createConversation("stu-1", "Second chat");
    // And one for stu-2 (should NOT appear)
    createConversation("stu-2", "Other student's chat");

    const req = new NextRequest("http://localhost/api/student/assistant/conversations");
    const res = await conversationsGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.conversations).toHaveLength(2);
    // List view should not include messages
    expect(body.data.conversations[0].messages).toBeUndefined();
    // Should have id + title + timestamps
    expect(body.data.conversations[0].id).toMatch(/^conv-/);
    expect(body.data.conversations[0].title).toBeDefined();
    expect(body.data.conversations[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does NOT return other students' conversations", async () => {
    createConversation("stu-2", "Someone else");

    const req = new NextRequest("http://localhost/api/student/assistant/conversations");
    const res = await conversationsGET(req);
    const body = await res.json();

    expect(body.data.conversations).toHaveLength(0);
  });

  it("returns empty list when student has no conversations", async () => {
    const req = new NextRequest("http://localhost/api/student/assistant/conversations");
    const res = await conversationsGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.conversations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────

describe("GET /api/student/assistant/conversations/[id]", () => {
  function makeGetRequest(id: string) {
    return new NextRequest(
      `http://localhost/api/student/assistant/conversations/${id}`,
    );
  }

  it("rejects unauthenticated requests (401)", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await conversationGET(makeGetRequest("conv-1"), {
      params: Promise.resolve({ id: "conv-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the conversation with messages", async () => {
    const conv = createConversation("stu-1", "My chat");
    appendMessage(conv.id, "stu-1", {
      role: "user",
      content: "What is my GPA?",
      createdAt: 1000,
    });
    appendMessage(conv.id, "stu-1", {
      role: "assistant",
      content: "Your GPA is 3.8.",
      createdAt: 2000,
    });

    const res = await conversationGET(makeGetRequest(conv.id), {
      params: Promise.resolve({ id: conv.id }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.conversation.id).toBe(conv.id);
    expect(body.data.conversation.title).toBe("My chat");
    expect(body.data.conversation.messages).toHaveLength(2);
    expect(body.data.conversation.messages[0].content).toBe("What is my GPA?");
    expect(body.data.conversation.messages[1].content).toBe("Your GPA is 3.8.");
  });

  it("returns 404 for a non-existent conversation", async () => {
    const res = await conversationGET(makeGetRequest("nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when trying to access another student's conversation (IDOR-safe)", async () => {
    const otherConv = createConversation("stu-2", "Someone else's chat");

    const res = await conversationGET(makeGetRequest(otherConv.id), {
      params: Promise.resolve({ id: otherConv.id }),
    });
    const body = await res.json();

    // Must be 404, NOT 403 — so the student can't tell whether the
    // conversation exists for someone else
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

// ─────────────────────────────────────────────────────────────────

describe("DELETE /api/student/assistant/conversations/[id]", () => {
  function makeDeleteRequest(id: string) {
    return new NextRequest(
      `http://localhost/api/student/assistant/conversations/${id}`,
      { method: "DELETE" },
    );
  }

  it("rejects unauthenticated requests (401)", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await conversationDELETE(makeDeleteRequest("conv-1"), {
      params: Promise.resolve({ id: "conv-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("deletes the student's own conversation", async () => {
    const conv = createConversation("stu-1", "My chat");

    const res = await conversationDELETE(makeDeleteRequest(conv.id), {
      params: Promise.resolve({ id: conv.id }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.deleted).toBe(true);
  });

  it("returns 404 for a non-existent conversation", async () => {
    const res = await conversationDELETE(makeDeleteRequest("nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when trying to delete another student's conversation (IDOR-safe)", async () => {
    const otherConv = createConversation("stu-2", "Someone else's chat");

    const res = await conversationDELETE(makeDeleteRequest(otherConv.id), {
      params: Promise.resolve({ id: otherConv.id }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("actually removes the conversation (subsequent GET returns 404)", async () => {
    const conv = createConversation("stu-1", "My chat");

    await conversationDELETE(makeDeleteRequest(conv.id), {
      params: Promise.resolve({ id: conv.id }),
    });

    // Now try to GET it — should be 404
    const getRes = await conversationGET(
      new NextRequest(`http://localhost/api/student/assistant/conversations/${conv.id}`),
      { params: Promise.resolve({ id: conv.id }) },
    );
    expect(getRes.status).toBe(404);
  });
});
