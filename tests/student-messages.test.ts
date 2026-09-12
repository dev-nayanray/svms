import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockConversationFindMany = vi.fn();
const mockConversationFindFirst = vi.fn();
const mockStudentFindUnique = vi.fn();
const mockMessageCreate = vi.fn();
const mockMessageUpdateMany = vi.fn();
const mockMessageGroupBy = vi.fn();
const mockConversationUpdate = vi.fn();
const mockAuditRecord = vi.fn();
const mockNotificationsPush = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: (args: unknown) => mockStudentFindFirst(args),
      findUnique: (args: unknown) => mockStudentFindUnique(args),
    },
    conversation: {
      findMany: (args: unknown) => mockConversationFindMany(args),
      findFirst: (args: unknown) => mockConversationFindFirst(args),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: (args: unknown) => mockConversationUpdate(args),
    },
    message: {
      create: (args: unknown) => mockMessageCreate(args),
      updateMany: (args: unknown) => mockMessageUpdateMany(args),
      groupBy: (args: unknown) => mockMessageGroupBy(args),
    },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: { record: (input: unknown) => mockAuditRecord(input) },
}));
vi.mock("@/lib/services/notification", () => ({
  notifications: { push: (input: unknown) => mockNotificationsPush(input) },
}));

import { GET as GET_list } from "@/app/api/student/messages/route";
import { GET as GET_detail } from "@/app/api/student/messages/[id]/route";
import { POST as POST_message } from "@/app/api/student/messages/[id]/messages/route";
import { PATCH as PATCH_read } from "@/app/api/student/messages/[id]/read/route";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const baseStudent = {
  id: "stu-1",
  userId: "user-1",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  email: "k@x.com",
  deletedAt: null,
};

const baseConversation = {
  id: "conv-1",
  studentId: "stu-1",
  employeeId: "emp-1",
  lastMessageAt: new Date("2026-09-12T10:00:00Z"),
  createdAt: new Date("2026-09-01T08:00:00Z"),
  updatedAt: new Date("2026-09-12T10:00:00Z"),
  employee: {
    id: "emp-1",
    user: { id: "user-2", name: "Sarah Counselor" },
  },
  messages: [
    {
      id: "msg-1",
      senderId: "user-2", // from counselor
      body: "Hello! How can I help you?",
      attachmentUrl: null,
      readAt: null,
      createdAt: new Date("2026-09-12T09:00:00Z"),
    },
    {
      id: "msg-2",
      senderId: "user-1", // from student
      body: "I have a question about my visa.",
      attachmentUrl: null,
      readAt: new Date("2026-09-12T09:30:00Z"),
      createdAt: new Date("2026-09-12T09:15:00Z"),
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockStudentFindUnique.mockResolvedValue({ userId: "user-1", firstName: "Karim", lastName: "Ahmed" });
  mockConversationFindMany.mockResolvedValue([baseConversation]);
  mockConversationFindFirst.mockResolvedValue(baseConversation);
  mockMessageGroupBy.mockResolvedValue([
    { conversationId: "conv-1", _count: { _all: 1 } },
  ]);
  mockMessageCreate.mockResolvedValue({
    id: "msg-new",
    senderId: "user-1",
    body: "Test message",
    attachmentUrl: null,
    readAt: null,
    createdAt: new Date("2026-09-12T12:00:00Z"),
  });
  mockMessageUpdateMany.mockResolvedValue({ count: 1 });
  mockConversationUpdate.mockResolvedValue({});
  mockAuditRecord.mockResolvedValue(undefined);
  mockNotificationsPush.mockResolvedValue(undefined);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/messages/conv-1/messages", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────
// GET /api/student/messages (list)
// ─────────────────────────────────────────────

describe("GET /api/student/messages (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(new NextRequest("http://localhost/api/student/messages"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/messages"));
    expect(res.status).toBe(403);
  });

  it("returns the caller's conversations with unread counts", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/messages"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.conversations.length).toBe(1);
    expect(body.data.conversations[0].id).toBe("conv-1");
    expect(body.data.conversations[0].counselorName).toBe("Sarah Counselor");
    expect(body.data.conversations[0].counselorInitials).toBe("SC");
    expect(body.data.conversations[0].unreadCount).toBe(1);
  });

  it("scopes findMany by studentId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/messages"));
    expect(mockConversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: "stu-1" }),
      }),
    );
  });

  it("includes latest message preview + timestamp", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/messages"));
    const body = await res.json();
    const conv = body.data.conversations[0];
    expect(conv.latestMessage).toBeDefined();
    expect(conv.latestMessageAt).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// GET /api/student/messages/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/messages/[id] (detail)", () => {
  async function callDetail(id: string) {
    return GET_detail(
      new NextRequest(`http://localhost/api/student/messages/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDetail("conv-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the conversation doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockConversationFindFirst.mockResolvedValue(null);
    const res = await callDetail("foreign-conv-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns the conversation with all messages", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("conv-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    const conv = body.data.conversation;
    expect(conv.id).toBe("conv-1");
    expect(conv.counselorName).toBe("Sarah Counselor");
    expect(conv.messages.length).toBe(2);
    // Messages have isMine flag
    expect(conv.messages[0].isMine).toBe(false); // from counselor
    expect(conv.messages[1].isMine).toBe(true); // from student
  });

  it("marks messages from the counselor as read on access", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("conv-1");
    expect(mockMessageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: "conv-1",
          senderId: "user-2", // counselor's userId
          readAt: null,
        }),
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
  });

  it("scopes findFirst by studentId (ownership check)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("conv-1");
    expect(mockConversationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "conv-1",
          studentId: "stu-1",
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// POST /api/student/messages/[id]/messages (send)
// ─────────────────────────────────────────────

describe("POST /api/student/messages/[id]/messages (send)", () => {
  async function callPost(body: unknown) {
    return POST_message(
      makePostReq(body),
      { params: Promise.resolve({ id: "conv-1" }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callPost({ body: "Hello" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the conversation doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockConversationFindFirst.mockResolvedValue(null);
    const res = await callPost({ body: "Hello" });
    expect(res.status).toBe(404);
  });

  it("creates a message with the student as senderId", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPost({ body: "I have a question" });
    expect(res.status).toBe(201);
    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: "conv-1",
          senderId: "user-1", // student's userId
          body: "I have a question",
        }),
      }),
    );
  });

  it("updates conversation lastMessageAt", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callPost({ body: "Test" });
    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-1" },
        data: expect.objectContaining({ lastMessageAt: expect.any(Date) }),
      }),
    );
  });

  it("notifies the counselor", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callPost({ body: "Test message" });
    expect(mockNotificationsPush).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2", // counselor's userId
        type: "NEW_MESSAGE",
      }),
    );
  });

  it("audit-logs the message send", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callPost({ body: "Test" });
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "student_message.sent",
        entity: "Message",
      }),
    );
  });

  it("returns 422 when body is empty", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPost({ body: "" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when body is too long (>5000 chars)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPost({ body: "x".repeat(5001) });
    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────
// PATCH /api/student/messages/[id]/read (mark read)
// ─────────────────────────────────────────────

describe("PATCH /api/student/messages/[id]/read (mark read)", () => {
  async function callPatch() {
    return PATCH_read(
      new NextRequest("http://localhost/api/student/messages/conv-1/read", { method: "PATCH" }),
      { params: Promise.resolve({ id: "conv-1" }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callPatch();
    expect(res.status).toBe(401);
  });

  it("returns 404 when the conversation doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockConversationFindFirst.mockResolvedValue(null);
    const res = await callPatch();
    expect(res.status).toBe(404);
  });

  it("marks messages from the counselor as read", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch();
    expect(res.status).toBe(200);
    expect(mockMessageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: "conv-1",
          senderId: "user-2", // counselor's userId
          readAt: null,
        }),
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
  });

  it("returns the count of messages marked", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch();
    const body = await res.json();
    expect(body.data.updated).toBe(true);
    expect(body.data.count).toBe(1);
  });
});
