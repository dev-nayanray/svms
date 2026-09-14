import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JsonValue } from "@prisma/client/runtime/library";

// ── Mock Prisma ───────────────────────────────────────────────────────
// We mock every model the service touches. Each function is a vi.fn so
// individual tests can stub return values or assert on call args.

const prismaMock = vi.hoisted(() => ({
  conversation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  message: {
    create: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  student: { findFirst: vi.fn() },
  application: { findFirst: vi.fn() },
  notification: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listConversations,
  getConversationById,
  requireConversation,
  startConversation,
  sendMessage,
  markConversationRead,
  getUnreadCount,
  pollNewMessages,
  conversationScope,
  studentOwnershipScope,
  MESSAGE_KINDS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_MESSAGE_BODY,
  type AttachmentInput,
  type ConversationListItem,
} from "@/lib/services/message-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };
const OTHER_EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp2", employeeId: "emp-2" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Constants ─────────────────────────────────────────────────────────

describe("message constants", () => {
  it("has 2 message kinds", () => {
    expect(MESSAGE_KINDS).toEqual(["STUDENT_MESSAGE", "INTERNAL_NOTE"]);
  });
  it("attachment limits are sensible", () => {
    expect(MAX_ATTACHMENTS_PER_MESSAGE).toBe(5);
    expect(MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_MESSAGE_BODY).toBe(10_000);
  });
});

// ── Scope filters (IDOR closure) ─────────────────────────────────────

describe("conversation scope filters", () => {
  it("EMPLOYEE scope filters by assigned employee via student", () => {
    const f = conversationScope(EMPLOYEE_SCOPE);
    expect(f).toEqual({ student: { assignedEmployeeId: "emp-1" } });
  });
  it("ADMIN scope is empty (sees all)", () => {
    const f = conversationScope(ADMIN_SCOPE);
    expect(f).toEqual({});
  });
  it("studentOwnershipScope mirrors conversationScope", () => {
    expect(studentOwnershipScope(EMPLOYEE_SCOPE)).toEqual({ assignedEmployeeId: "emp-1" });
    expect(studentOwnershipScope(ADMIN_SCOPE)).toEqual({});
  });
});

// ── listConversations ─────────────────────────────────────────────────

describe("listConversations", () => {
  it("returns empty list with proper pagination shape", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.conversation.count.mockResolvedValue(0);
    const r = await listConversations(EMPLOYEE_SCOPE, {});
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.totalPages).toBe(1);
    expect(prismaMock.conversation.findMany.mock.calls[0][0].where).toMatchObject({
      student: { assignedEmployeeId: "emp-1" },
    });
  });

  it("embeds the EMPLOYEE scope filter (IDOR closure)", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.conversation.count.mockResolvedValue(0);
    await listConversations(EMPLOYEE_SCOPE, {});
    const where = prismaMock.conversation.findMany.mock.calls[0][0].where;
    expect(where.student.assignedEmployeeId).toBe("emp-1");
  });

  it("ADMIN scope does not include assignedEmployeeId", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.conversation.count.mockResolvedValue(0);
    await listConversations(ADMIN_SCOPE, {});
    const where = prismaMock.conversation.findMany.mock.calls[0][0].where;
    expect(where.student).toBeUndefined();
  });

  it("search uses OR across student name + email + subject", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.conversation.count.mockResolvedValue(0);
    await listConversations(EMPLOYEE_SCOPE, { filters: { search: "Karim" } });
    const where = prismaMock.conversation.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(where.OR.length).toBeGreaterThan(0);
    expect(where.OR.some((c: Record<string, unknown>) => "subject" in c)).toBe(true);
    expect(where.OR.some((c: Record<string, unknown>) => "student" in c)).toBe(true);
  });

  it("returns rows with lastMessage + unreadCount", async () => {
    const convRow = {
      id: "c1", subject: "Welcome",
      createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
      student: { id: "s1", firstName: "Karim", lastName: "Ahmed", email: "k@x.com" },
      application: { id: "a1", applicationNumber: "APP-001" },
      employee: { id: "e1", user: { name: "Counselor" } },
      messages: [{
        id: "m1", body: "Hello!", kind: "STUDENT_MESSAGE",
        senderId: "u-stu", createdAt: new Date("2026-01-02"),
      }],
    };
    prismaMock.conversation.findMany.mockResolvedValue([convRow]);
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.message.count.mockResolvedValue(3); // 3 unread

    const r = await listConversations(EMPLOYEE_SCOPE, {});
    expect(r.rows).toHaveLength(1);
    const row = r.rows[0] as ConversationListItem;
    expect(row.unreadCount).toBe(3);
    expect(row.lastMessage?.body).toBe("Hello!");
    expect(row.student.firstName).toBe("Karim");
    expect(row.application?.applicationNumber).toBe("APP-001");
    expect(row.employee?.name).toBe("Counselor");
  });

  it("unreadOnly filter drops conversations with zero unread", async () => {
    const convRow = {
      id: "c1", subject: "Hi",
      createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
      student: { id: "s1", firstName: "Karim", lastName: "Ahmed", email: "k@x.com" },
      application: null, employee: null,
      messages: [{ id: "m1", body: "Hi", kind: "STUDENT_MESSAGE", senderId: "u-stu", createdAt: new Date() }],
    };
    prismaMock.conversation.findMany.mockResolvedValue([convRow]);
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.message.count.mockResolvedValue(0); // zero unread

    const r = await listConversations(EMPLOYEE_SCOPE, { filters: { unreadOnly: true } });
    expect(r.rows).toHaveLength(0);
  });

  it("lets prisma errors bubble (network failure propagation)", async () => {
    prismaMock.conversation.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.conversation.count.mockResolvedValue(0);
    await expect(listConversations(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });
});

// ── getConversationById / requireConversation ─────────────────────────

describe("getConversationById", () => {
  it("returns null when not found", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    const r = await getConversationById(EMPLOYEE_SCOPE, "c-foreign");
    expect(r).toBeNull();
  });

  it("returns null for foreign conversations (IDOR)", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    const r = await getConversationById(EMPLOYEE_SCOPE, "c-foreign");
    expect(r).toBeNull();
  });

  it("returns conversation detail with normalized attachments", async () => {
    const rawAttachments = [
      { fileUrl: "https://x/y.pdf", fileName: "y.pdf", mimeType: "application/pdf", fileSize: 100, uploadedAt: "2026-01-01T00:00:00.000Z" },
      { fileUrl: "https://x/z.png", fileName: "z.png", mimeType: "image/png", fileSize: 200, uploadedAt: "2026-01-01T00:00:00.000Z" },
    ];
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "c1", subject: "Hi",
      createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"),
      student: { id: "s1", firstName: "Karim", lastName: "Ahmed", email: "k@x.com", studentId: "STD-2026-000001" },
      application: null,
      employee: { id: "e1", user: { name: "Counselor" } },
      messages: [
        { id: "m1", body: "Hello", kind: "STUDENT_MESSAGE", senderId: "u-stu", readAt: null, createdAt: new Date("2026-01-02"), attachments: rawAttachments as unknown as JsonValue },
        { id: "m2", body: "Internal", kind: "INTERNAL_NOTE", senderId: "u-emp", readAt: new Date(), createdAt: new Date("2026-01-03"), attachments: null },
        { id: "m3", body: "Bad attach", kind: "STUDENT_MESSAGE", senderId: "u-stu", readAt: null, createdAt: new Date("2026-01-04"), attachments: [{ fileUrl: "x" }] as unknown as JsonValue }, // malformed → filtered out
      ],
    });
    const r = await getConversationById(EMPLOYEE_SCOPE, "c1");
    expect(r).not.toBeNull();
    expect(r!.messages).toHaveLength(3);
    expect(r!.messages[0].attachments).toHaveLength(2);
    expect(r!.messages[0].attachments[0].fileName).toBe("y.pdf");
    expect(r!.messages[1].attachments).toEqual([]);
    expect(r!.messages[2].attachments).toEqual([]); // malformed one filtered
  });
});

describe("requireConversation", () => {
  it("throws 404 when not found", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    await expect(requireConversation(EMPLOYEE_SCOPE, "c-x")).rejects.toMatchObject({
      status: 404, code: "NOT_FOUND",
    });
  });
});

// ── startConversation ─────────────────────────────────────────────────

describe("startConversation", () => {
  it("rejects empty studentId (422)", async () => {
    await expect(startConversation(EMPLOYEE_SCOPE, { studentId: "" }, { id: "u-emp" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects when student is not owned by caller (IDOR — 404)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    await expect(startConversation(EMPLOYEE_SCOPE, { studentId: "s-foreign" }, { id: "u-emp" }))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    // Confirm the scope was applied
    expect(prismaMock.student.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "s-foreign", assignedEmployeeId: "emp-1",
    });
  });

  it("rejects when applicationId does not belong to the student (404)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", assignedEmployeeId: "emp-1" });
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(
      startConversation(EMPLOYEE_SCOPE, { studentId: "s1", applicationId: "a-foreign" }, { id: "u-emp" }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("creates conversation with first message + audit log", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", assignedEmployeeId: "emp-1" });
    prismaMock.conversation.create.mockResolvedValue({ id: "c1" });
    prismaMock.auditLog.create.mockResolvedValue({});

    const r = await startConversation(
      EMPLOYEE_SCOPE,
      { studentId: "s1", subject: "Welcome", firstMessage: "Hi Karim!", firstMessageKind: "STUDENT_MESSAGE" },
      { id: "u-emp" },
    );
    expect(r.id).toBe("c1");
    expect(prismaMock.conversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: "s1",
        employeeId: "emp-1",
        subject: "Welcome",
        messages: expect.objectContaining({
          create: expect.arrayContaining([
            expect.objectContaining({
              senderId: "u-emp", body: "Hi Karim!", kind: "STUDENT_MESSAGE", readAt: expect.any(Date),
            }),
          ]),
        }),
      }),
    }));
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "conversation.created" }),
    }));
  });

  it("ADMIN caller attaches to student's assignedEmployeeId", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", assignedEmployeeId: "emp-1" });
    prismaMock.conversation.create.mockResolvedValue({ id: "c1" });
    prismaMock.auditLog.create.mockResolvedValue({});
    await startConversation(ADMIN_SCOPE, { studentId: "s1" }, { id: "u-admin" });
    expect(prismaMock.conversation.create.mock.calls[0][0].data.employeeId).toBe("emp-1");
  });

  it("rejects invalid firstMessageKind (400)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", assignedEmployeeId: "emp-1" });
    await expect(
      startConversation(
        EMPLOYEE_SCOPE,
        { studentId: "s1", firstMessage: "x", firstMessageKind: "BAD_KIND" as unknown as "STUDENT_MESSAGE" },
        { id: "u-emp" },
      ),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("rejects oversized body (422)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", assignedEmployeeId: "emp-1" });
    await expect(
      startConversation(
        EMPLOYEE_SCOPE,
        { studentId: "s1", firstMessage: "x".repeat(MAX_MESSAGE_BODY + 1) },
        { id: "u-emp" },
      ),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });
});

// ── sendMessage ───────────────────────────────────────────────────────

describe("sendMessage", () => {
  it("rejects empty body (422)", async () => {
    await expect(sendMessage(EMPLOYEE_SCOPE, "c1", { body: "" }, { id: "u-emp" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    await expect(sendMessage(EMPLOYEE_SCOPE, "c1", { body: "   " }, { id: "u-emp" }))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects invalid kind (400)", async () => {
    await expect(
      sendMessage(EMPLOYEE_SCOPE, "c1", { body: "hi", kind: "BAD" as unknown as "STUDENT_MESSAGE" }, { id: "u-emp" }),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("returns 404 when conversation not in scope (IDOR)", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    await expect(sendMessage(EMPLOYEE_SCOPE, "c-foreign", { body: "hi" }, { id: "u-emp" }))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("creates message + bumps updatedAt + audits + notifies for STUDENT_MESSAGE", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.create.mockResolvedValue({ id: "m1" });
    prismaMock.conversation.update.mockResolvedValue({});
    prismaMock.conversation.findUnique.mockResolvedValue({
      student: { userId: "u-stu", firstName: "Karim" },
    });
    prismaMock.notification.create.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const r = await sendMessage(
      EMPLOYEE_SCOPE,
      "c1",
      { body: "Hello Karim!", kind: "STUDENT_MESSAGE" },
      { id: "u-emp" },
    );
    expect(r.id).toBe("m1");
    expect(prismaMock.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        conversationId: "c1", senderId: "u-emp", body: "Hello Karim!", kind: "STUDENT_MESSAGE",
        readAt: expect.any(Date),
      }),
    }));
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "c1" }, data: { updatedAt: expect.any(Date) },
    }));
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-stu", type: "MESSAGE_RECEIVED" }),
    }));
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "message.sent" }),
    }));
  });

  it("does NOT notify student when sending an INTERNAL_NOTE", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.create.mockResolvedValue({ id: "m2" });
    prismaMock.conversation.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    await sendMessage(
      EMPLOYEE_SCOPE,
      "c1",
      { body: "Reminder: follow up tomorrow", kind: "INTERNAL_NOTE" },
      { id: "u-emp" },
    );
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(prismaMock.message.create.mock.calls[0][0].data.kind).toBe("INTERNAL_NOTE");
  });

  it("survives notification failure (best-effort)", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.create.mockResolvedValue({ id: "m3" });
    prismaMock.conversation.update.mockResolvedValue({});
    prismaMock.conversation.findUnique.mockResolvedValue({ student: { userId: "u-stu", firstName: "K" } });
    prismaMock.notification.create.mockRejectedValue(new Error("notify failed"));
    prismaMock.auditLog.create.mockResolvedValue({});

    // Should NOT throw
    const r = await sendMessage(EMPLOYEE_SCOPE, "c1", { body: "hi" }, { id: "u-emp" });
    expect(r.id).toBe("m3");
  });
});

// ── Attachment validation ─────────────────────────────────────────────

describe("attachment validation", () => {
  const validAttachments: AttachmentInput[] = [
    { fileUrl: "https://x/y.pdf", fileName: "y.pdf", mimeType: "application/pdf", fileSize: 1024 },
  ];

  it("accepts valid attachments", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.create.mockResolvedValue({ id: "m1" });
    prismaMock.conversation.update.mockResolvedValue({});
    prismaMock.conversation.findUnique.mockResolvedValue({ student: { userId: "u-stu", firstName: "K" } });
    prismaMock.notification.create.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await sendMessage(EMPLOYEE_SCOPE, "c1", { body: "see file", attachments: validAttachments }, { id: "u-emp" });
    expect(prismaMock.message.create).toHaveBeenCalled();
  });

  it("rejects more than MAX_ATTACHMENTS_PER_MESSAGE attachments (422)", async () => {
    const tooMany: AttachmentInput[] = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, () => ({
      fileUrl: "https://x/y.pdf", fileName: "y.pdf", mimeType: "application/pdf", fileSize: 100,
    }));
    await expect(
      sendMessage(EMPLOYEE_SCOPE, "c1", { body: "hi", attachments: tooMany }, { id: "u-emp" }),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects unsupported mime type (422)", async () => {
    const bad: AttachmentInput[] = [
      { fileUrl: "https://x/y.exe", fileName: "y.exe", mimeType: "application/x-msdownload", fileSize: 100 },
    ];
    await expect(
      sendMessage(EMPLOYEE_SCOPE, "c1", { body: "hi", attachments: bad }, { id: "u-emp" }),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects oversized attachment (422)", async () => {
    const big: AttachmentInput[] = [
      { fileUrl: "https://x/y.pdf", fileName: "y.pdf", mimeType: "application/pdf", fileSize: MAX_ATTACHMENT_BYTES + 1 },
    ];
    await expect(
      sendMessage(EMPLOYEE_SCOPE, "c1", { body: "hi", attachments: big }, { id: "u-emp" }),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("rejects missing fileUrl (422)", async () => {
    const bad = [{ fileName: "y.pdf", mimeType: "application/pdf", fileSize: 100 }] as unknown as AttachmentInput[];
    await expect(
      sendMessage(EMPLOYEE_SCOPE, "c1", { body: "hi", attachments: bad }, { id: "u-emp" }),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });
});

// ── markConversationRead ──────────────────────────────────────────────

describe("markConversationRead", () => {
  it("marks messages not from the caller as read", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.updateMany.mockResolvedValue({ count: 3 });

    const r = await markConversationRead(EMPLOYEE_SCOPE, "c1", "u-emp");
    expect(r.updated).toBe(3);
    expect(prismaMock.message.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conversationId: "c1",
        senderId: { not: "u-emp" },
        readAt: null,
      }),
      data: { readAt: expect.any(Date) },
    }));
  });

  it("IDOR: foreign conversation returns 404", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    await expect(markConversationRead(EMPLOYEE_SCOPE, "c-foreign", "u-emp"))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("returns updated: 0 when nothing unread", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.updateMany.mockResolvedValue({ count: 0 });
    const r = await markConversationRead(EMPLOYEE_SCOPE, "c1", "u-emp");
    expect(r.updated).toBe(0);
  });
});

// ── getUnreadCount ────────────────────────────────────────────────────

describe("getUnreadCount", () => {
  it("returns total + per-conversation breakdown", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      { id: "c1", _count: { messages: 3 } },
      { id: "c2", _count: { messages: 0 } }, // filtered out
      { id: "c3", _count: { messages: 1 } },
    ]);
    const r = await getUnreadCount(EMPLOYEE_SCOPE);
    expect(r.total).toBe(4);
    expect(r.byConversation).toHaveLength(2);
    expect(r.byConversation[0].conversationId).toBe("c1");
    expect(r.byConversation[0].unread).toBe(3);
  });

  it("uses scope filter (IDOR)", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    await getUnreadCount(EMPLOYEE_SCOPE);
    expect(prismaMock.conversation.findMany.mock.calls[0][0].where).toMatchObject({
      student: { assignedEmployeeId: "emp-1" },
    });
  });
});

// ── pollNewMessages ───────────────────────────────────────────────────

describe("pollNewMessages", () => {
  it("returns messages created after the cursor", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.findMany.mockResolvedValue([
      { id: "m2", body: "new", kind: "STUDENT_MESSAGE", senderId: "u-stu", readAt: null, createdAt: new Date(), attachments: null },
    ]);
    const since = new Date("2026-01-01");
    const r = await pollNewMessages(EMPLOYEE_SCOPE, "c1", since);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].body).toBe("new");
    expect(prismaMock.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conversationId: "c1",
        createdAt: { gt: since },
      }),
      take: 100,
    }));
  });

  it("IDOR: foreign conversation returns 404", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    await expect(pollNewMessages(EMPLOYEE_SCOPE, "c-foreign", new Date()))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ── Conversation access (integration-style IDOR) ─────────────────────

describe("conversation access (IDOR across employees)", () => {
  it("EMPLOYEE A cannot read EMPLOYEE B's conversation", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null); // scope filters it out
    const r = await getConversationById(EMPLOYEE_SCOPE, "c-owned-by-emp2");
    expect(r).toBeNull();
    // The scope filter on emp-1 was applied
    expect(prismaMock.conversation.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "c-owned-by-emp2", student: { assignedEmployeeId: "emp-1" },
    });
  });

  it("EMPLOYEE A cannot send to EMPLOYEE B's conversation", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    await expect(
      sendMessage(OTHER_EMPLOYEE_SCOPE, "c-owned-by-emp1", { body: "hi" }, { id: "u-emp2" }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("ADMIN can access any conversation (no scope filter)", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "c1", subject: "x",
      createdAt: new Date(), updatedAt: new Date(),
      student: { id: "s1", firstName: "K", lastName: "A", email: "k@x.com", studentId: "STD-1" },
      application: null, employee: null, messages: [],
    });
    const r = await getConversationById(ADMIN_SCOPE, "c1");
    expect(r).not.toBeNull();
    expect(prismaMock.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "c1" });
  });
});

// ── Empty states ──────────────────────────────────────────────────────

describe("empty states", () => {
  it("listConversations returns empty array (not null) when no rows", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.conversation.count.mockResolvedValue(0);
    const r = await listConversations(EMPLOYEE_SCOPE, {});
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("getConversationById on a conversation with no messages returns messages: []", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "c1", subject: null,
      createdAt: new Date(), updatedAt: new Date(),
      student: { id: "s1", firstName: "K", lastName: "A", email: "k@x.com", studentId: "STD-1" },
      application: null, employee: null, messages: [],
    });
    const r = await getConversationById(EMPLOYEE_SCOPE, "c1");
    expect(r?.messages).toEqual([]);
  });

  it("getUnreadCount returns 0 when no conversations exist", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    const r = await getUnreadCount(EMPLOYEE_SCOPE);
    expect(r.total).toBe(0);
    expect(r.byConversation).toEqual([]);
  });
});

// ── Network failure propagation ───────────────────────────────────────

describe("network failure propagation", () => {
  it("listConversations lets prisma errors bubble", async () => {
    prismaMock.conversation.findMany.mockRejectedValue(new Error("ECONNRESET"));
    prismaMock.conversation.count.mockResolvedValue(0);
    await expect(listConversations(EMPLOYEE_SCOPE, {})).rejects.toThrow("ECONNRESET");
  });

  it("getConversationById lets prisma errors bubble", async () => {
    prismaMock.conversation.findFirst.mockRejectedValue(new Error("timeout"));
    await expect(getConversationById(EMPLOYEE_SCOPE, "c1")).rejects.toThrow("timeout");
  });

  it("sendMessage lets message.create errors bubble (no silent swallow)", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.create.mockRejectedValue(new Error("write failed"));
    await expect(sendMessage(EMPLOYEE_SCOPE, "c1", { body: "x" }, { id: "u-emp" }))
      .rejects.toThrow("write failed");
  });

  it("markConversationRead lets updateMany errors bubble", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.updateMany.mockRejectedValue(new Error("update fail"));
    await expect(markConversationRead(EMPLOYEE_SCOPE, "c1", "u-emp")).rejects.toThrow("update fail");
  });

  it("startConversation lets prisma create errors bubble", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", assignedEmployeeId: "emp-1" });
    prismaMock.conversation.create.mockRejectedValue(new Error("write fail"));
    await expect(
      startConversation(EMPLOYEE_SCOPE, { studentId: "s1" }, { id: "u-emp" }),
    ).rejects.toThrow("write fail");
  });
});

// ── Authorization / permission gating ────────────────────────────────

describe("authorization gating (service-level IDOR closure)", () => {
  it("EMPLOYEE scope always carries assignedEmployeeId filter (never trusts client)", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([]);
    prismaMock.conversation.count.mockResolvedValue(0);
    await listConversations(EMPLOYEE_SCOPE, { filters: { studentId: "s-from-client" } });
    // Even if the client passes a studentId, the EMPLOYEE scope filter is still applied
    const where = prismaMock.conversation.findMany.mock.calls[0][0].where;
    expect(where.student.assignedEmployeeId).toBe("emp-1");
    expect(where.studentId).toBe("s-from-client");
  });

  it("ADMIN scope ignores student ownership check (sees all)", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1", assignedEmployeeId: "emp-1" });
    prismaMock.conversation.create.mockResolvedValue({ id: "c1" });
    prismaMock.auditLog.create.mockResolvedValue({});
    await startConversation(ADMIN_SCOPE, { studentId: "s1" }, { id: "u-admin" });
    // ADMIN scope is {} — no assignedEmployeeId filter on the student lookup
    expect(prismaMock.student.findFirst.mock.calls[0][0].where).toEqual({ id: "s1" });
  });
});

// ── Internal note isolation ──────────────────────────────────────────

describe("internal note isolation", () => {
  it("INTERNAL_NOTE messages are returned to employees (employee service is the source of truth)", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "c1", subject: null,
      createdAt: new Date(), updatedAt: new Date(),
      student: { id: "s1", firstName: "K", lastName: "A", email: "k@x.com", studentId: "STD-1" },
      application: null, employee: null,
      messages: [
        { id: "m1", body: "student-visible", kind: "STUDENT_MESSAGE", senderId: "u-stu", readAt: null, createdAt: new Date(), attachments: null },
        { id: "m2", body: "internal note", kind: "INTERNAL_NOTE", senderId: "u-emp", readAt: null, createdAt: new Date(), attachments: null },
      ],
    });
    const r = await getConversationById(EMPLOYEE_SCOPE, "c1");
    expect(r?.messages).toHaveLength(2);
    expect(r?.messages.map((m) => m.kind)).toContain("INTERNAL_NOTE");
  });

  it("sendMessage with INTERNAL_NOTE does not fire a notification to the student", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.message.create.mockResolvedValue({ id: "m-internal" });
    prismaMock.conversation.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    await sendMessage(EMPLOYEE_SCOPE, "c1", { body: "private", kind: "INTERNAL_NOTE" }, { id: "u-emp" });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    // Sanity: audit log still recorded
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });
});
