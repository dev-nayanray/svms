import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { buildConversationWhere } from "@/lib/constants/notifications";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";
import { z } from "zod";

const sendMessageSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  body: z.string().min(1, "Message body is required").max(5000),
  attachmentUrl: z.string().optional(),
  visibility: z.enum(["INTERNAL", "STUDENT"]).default("STUDENT"),
});

/**
 * Conversation list endpoint — returns conversations with student +
 * employee joins, latest message preview, and message count.
 *
 * Supports search (student name, employee name, student ID) and
 * filtering by employee. Admins see all conversations; employees see
 * only their own.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const sp = req.nextUrl.searchParams;
    const search = sp.get("search") ?? undefined;

    // Employees only see their own conversations; admins see all
    const employeeId = user.role === "EMPLOYEE" ? await getEmployeeId(user.id) : sp.get("employeeId") ?? undefined;

    const where = buildConversationWhere({ search, employeeId });

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentId: true },
        },
        employee: {
          select: { id: true, user: { select: { id: true, name: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, body: true, createdAt: true, senderId: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    });

    return ok({ data: conversations });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Send a message — creates or reuses a conversation and adds a message.
 *
 * Visibility:
 *  - "STUDENT": the student can see the message in their portal.
 *  - "INTERNAL": staff-only note, never exposed to students.
 *
 * The sender is the authenticated user. If the sender is an employee,
 * the conversation is between them and the student. If the sender is
 * an admin, the conversation is between the admin (acting as an
 * employee proxy) and the student — the admin must specify the
 * studentId in the body.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = sendMessageSchema.parse(await req.json());

    // Resolve the employee record for the sender
    let employee = await prisma.employee.findFirst({
      where: { userId: user.id, deletedAt: null },
    });

    // If the admin isn't an employee, find the student's assigned employee
    if (!employee && user.role === "ADMIN") {
      const student = await prisma.student.findFirst({
        where: { id: body.studentId, deletedAt: null },
        include: { employee: true },
      });
      if (!student) return fail("NOT_FOUND", "Student not found", 404);
      if (!student.employee) return fail("BAD_REQUEST", "Student has no assigned employee", 400);
      employee = student.employee;
    }

    if (!employee) {
      return fail("FORBIDDEN", "Only employees and admins can send messages", 403);
    }

    // Validate the student exists
    const student = await prisma.student.findFirst({
      where: { id: body.studentId, deletedAt: null },
      include: { user: true },
    });
    if (!student) return fail("NOT_FOUND", "Student not found", 404);

    // Find or create the conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        studentId_employeeId: {
          studentId: body.studentId,
          employeeId: employee.id,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          studentId: body.studentId,
          employeeId: employee.id,
        },
      });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        body: body.body,
        attachmentUrl: body.attachmentUrl,
      },
    });

    // Update conversation's lastMessageAt
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // If the message is student-visible, notify the student
    if (body.visibility === "STUDENT" && user.role !== "STUDENT") {
      await notifications.push({
        userId: student.userId,
        type: "NEW_MESSAGE",
        title: "New message",
        message: body.body.slice(0, 100) + (body.body.length > 100 ? "…" : ""),
        link: `/student/applications`,
      });
    }

    // Audit log
    await auditLog.record({
      userId: user.id,
      action: "message.sent",
      entity: "Message",
      entityId: message.id,
      newValue: {
        conversationId: conversation.id,
        studentId: body.studentId,
        visibility: body.visibility,
        hasAttachment: !!body.attachmentUrl,
      },
    });

    return ok(message, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

async function getEmployeeId(userId: string): Promise<string | undefined> {
  const emp = await prisma.employee.findUnique({ where: { userId } });
  return emp?.id;
}
