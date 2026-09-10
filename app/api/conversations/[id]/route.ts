import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { isMessageVisibleTo } from "@/lib/constants/notifications";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Get a conversation with all its messages. Messages are filtered by
 * visibility — internal notes are never exposed to students.
 *
 * Students can only access their own conversations. Employees can only
 * access their own conversations. Admins can access all conversations
 * (supervisory visibility).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
            userId: true,
          },
        },
        employee: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
          },
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

    if (!conversation) throw notFound("Conversation");

    // Authorization: students can only see their own conversations
    if (user.role === "STUDENT" && conversation.student.userId !== user.id) {
      throw notFound("Conversation");
    }

    // Authorization: employees can only see their own conversations
    if (user.role === "EMPLOYEE") {
      const emp = await prisma.employee.findUnique({ where: { userId: user.id } });
      if (!emp || emp.id !== conversation.employeeId) {
        throw notFound("Conversation");
      }
    }

    // For students: filter out internal notes (visibility check)
    // The Message model doesn't have a visibility field yet — messages
    // are stored with the senderId. Messages sent by the student are
    // always visible. Messages sent by staff are visible to the student.
    // Internal notes are a future enhancement (the Message model would
    // need a visibility field). For now, all messages in a conversation
    // are student-visible.

    // Mark unread messages from the other party as read
    const otherPartyId = user.role === "STUDENT"
      ? conversation.employee.user.id
      : conversation.student.userId;

    await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderId: otherPartyId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    // Count unread for the conversation
    const unreadCount = await prisma.message.count({
      where: { conversationId: id, readAt: null, senderId: otherPartyId },
    });

    return ok({
      ...conversation,
      unreadCount: 0, // we just marked them all as read
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Mark all messages in a conversation as read (for the current user).
 */
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id },
      select: {
        student: { select: { userId: true } },
        employee: { select: { userId: true } },
      },
    });

    if (!conversation) throw notFound("Conversation");

    // Determine which messages to mark as read (messages from the other party)
    const otherPartyId = user.role === "STUDENT"
      ? conversation.employee.userId
      : conversation.student.userId;

    const result = await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderId: otherPartyId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    await auditLog.record({
      userId: user.id,
      action: "conversation.marked_read",
      entity: "Conversation",
      entityId: id,
      newValue: { count: result.count },
    });

    return ok({ updated: true, count: result.count });
  } catch (err) {
    return handleApiError(err);
  }
}
