import { prisma } from "@/lib/db";
import { STUDENT_LIST_MAX_ROWS } from "@/lib/constants/pagination";
import { HttpError } from "@/lib/api";
import { auditLog } from "./audit";
import { notifications } from "./notification";
import { z } from "zod";

/**
 * Student-scoped Messages service for Module 13 (Student Messages).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session
 * (via `studentApiGuard()` at the route layer). The service NEVER
 * trusts a `conversationId` from the client without re-verifying that
 * the conversation's `studentId` matches the caller. Foreign/missing
 * records both return null → the route 404s (NOT_FOUND, never 403).
 *
 * DATA EXFILTRATION GUARD
 * ------------------------
 * Students can only access conversations they belong to
 * (conversation.studentId === session studentId). They can NEVER see:
 *  - internal employee conversations
 *  - admin messages to other students
 *  - internal notes (the Message model doesn't have a visibility
 *    field yet; when it does, INTERNAL messages will be filtered)
 *  - other students' conversations
 *
 * REAL-TIME ARCHITECTURE
 * -----------------------
 * No WebSocket infrastructure is introduced. Instead, the UI uses
 * TanStack Query's `refetchInterval` for clean polling:
 *  - Inbox: polls every 30 seconds for unread count updates
 *  - Chat view: polls every 5 seconds for new messages when active
 *
 * This is simpler than WebSockets and doesn't require additional server
 * infrastructure. The polling frequency is tuned to feel responsive
 * without overwhelming the server.
 */

const sendMessageSchema = z.object({
  body: z.string().min(1, "Message body is required").max(5000, "Message too long"),
  attachmentUrl: z.string().url("Must be a valid URL").refine(u => /^https?:\/\//.test(u), "Must be http(s) URL").optional().or(z.literal("")),
});

export type ConversationSummary = {
  id: string;
  counselorName: string;
  counselorInitials: string;
  counselorId: string;
  latestMessage: string | null;
  latestMessageAt: Date | null;
  latestMessageSenderId: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
  isMine: boolean;
};

export type ConversationDetail = {
  id: string;
  counselorName: string;
  counselorInitials: string;
  counselorId: string;
  messages: ChatMessage[];
  unreadCount: number;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

export const studentMessageService = {
  /**
   * List the caller's conversations (inbox). Scoped by `studentId`
   * from the session. Returns: counselor name, initials, latest
   * message preview, timestamp, and unread count.
   */
  async list(studentId: string): Promise<ConversationSummary[]> {
    const conversations = await prisma.conversation.findMany({
      where: { studentId, student: { deletedAt: null } },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, body: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: STUDENT_LIST_MAX_ROWS,
    });

    // Count unread messages (messages from the counselor that the
    // student hasn't read yet). We need the student's userId for this
    // — messages are stored with senderId = userId.
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    const studentUserId = student?.userId ?? "";

    const conversationIds = conversations.map((c) => c.id);

    // Get unread counts per conversation
    const unreadCounts = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: studentUserId },
        readAt: null,
      },
      _count: { _all: true },
    });

    const unreadMap = new Map(
      unreadCounts.map((u) => [u.conversationId, u._count._all]),
    );

    return conversations.map((c) => {
      const counselorName = c.employee?.user?.name ?? "Counselor";
      const latestMsg = c.messages[0] ?? null;
      return {
        id: c.id,
        counselorName,
        counselorInitials: getInitials(counselorName),
        counselorId: c.employee?.user?.id ?? "",
        latestMessage: latestMsg?.body ?? null,
        latestMessageAt: latestMsg?.createdAt ?? c.lastMessageAt,
        latestMessageSenderId: latestMsg?.senderId ?? null,
        unreadCount: unreadMap.get(c.id) ?? 0,
      };
    });
  },

  /**
   * Get one conversation with all messages. Ownership is verified:
   * the query is scoped by `studentId`. Foreign `conversationId`
   * returns null → route 404s.
   *
   * On access, messages from the counselor are marked as read (the
   * student has seen them by opening the chat).
   */
  async getById(studentId: string, conversationId: string): Promise<ConversationDetail | null> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    const studentUserId = student?.userId ?? "";

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, studentId, student: { deletedAt: null } },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true } } },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderId: true,
            body: true,
            attachmentUrl: true,
            readAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) return null;

    const counselorName = conversation.employee?.user?.name ?? "Counselor";

    // Mark messages from the counselor as read
    const counselorUserId = conversation.employee?.user?.id ?? "";
    if (counselorUserId) {
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: counselorUserId,
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }

    const messages: ChatMessage[] = conversation.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      attachmentUrl: m.attachmentUrl,
      readAt: m.readAt,
      createdAt: m.createdAt,
      isMine: m.senderId === studentUserId,
    }));

    return {
      id: conversation.id,
      counselorName,
      counselorInitials: getInitials(counselorName),
      counselorId: counselorUserId,
      messages,
      unreadCount: 0, // we just marked them all as read
    };
  },

  /**
   * Send a message in a conversation. The sender is the student
   * (senderId = student's userId from the session). The conversation
   * must belong to the caller (ownership verified).
   *
   * Body is validated (min 1 char, max 5000). The message is created,
   * the conversation's lastMessageAt is updated, and the counselor is
   * notified.
   */
  async sendMessage(
    studentId: string,
    conversationId: string,
    body: string,
    attachmentUrl?: string,
  ) {
    // Validate the body
    const parsed = sendMessageSchema.parse({ body, attachmentUrl });

    // Verify ownership
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, studentId, student: { deletedAt: null } },
      include: {
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!conversation) {
      throw new HttpError(404, "NOT_FOUND", "Conversation not found");
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true, firstName: true, lastName: true },
    });

    if (!student) {
      throw new HttpError(404, "NOT_FOUND", "Student not found");
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: student.userId,
        body: parsed.body,
        attachmentUrl: parsed.attachmentUrl ?? null,
      },
    });

    // Update conversation's lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Notify the counselor
    if (conversation.employee?.user?.id) {
      await notifications.push({
        userId: conversation.employee.user.id,
        type: "NEW_MESSAGE",
        title: "New message from student",
        message: `${student.firstName} ${student.lastName}: ${parsed.body.slice(0, 100)}${parsed.body.length > 100 ? "…" : ""}`,
        link: "/employee/students",
      });
    }

    // Audit log
    await auditLog.record({
      userId: student.userId,
      action: "student_message.sent",
      entity: "Message",
      entityId: message.id,
      newValue: {
        conversationId,
        hasAttachment: !!parsed.attachmentUrl,
      },
    });

    return {
      id: message.id,
      senderId: message.senderId,
      body: message.body,
      attachmentUrl: message.attachmentUrl,
      readAt: message.readAt,
      createdAt: message.createdAt,
      isMine: true,
    };
  },

  /**
   * Mark all messages from the counselor as read. The conversation
   * must belong to the caller.
   */
  async markRead(studentId: string, conversationId: string): Promise<number> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, studentId, student: { deletedAt: null } },
      include: {
        employee: { include: { user: { select: { id: true } } } },
      },
    });

    if (!conversation) {
      throw new HttpError(404, "NOT_FOUND", "Conversation not found");
    }

    const counselorUserId = conversation.employee?.user?.id ?? "";

    const result = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: counselorUserId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return result.count;
  },
};

/** Re-export for the route layer. */
export type StudentConversationView = ConversationDetail;
