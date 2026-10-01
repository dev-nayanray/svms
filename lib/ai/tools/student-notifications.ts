/**
 * Tool: getStudentNotifications
 * ==============================
 *
 * Returns the student's recent + unread notifications.
 *
 * SECURITY:
 *  - `studentId` from `ctx` → but `Notification` is keyed by `userId`,
 *    not `studentId`. We resolve the student's `userId` from the
 *    `Student` record, then query notifications by that `userId`.
 *    This prevents a student from querying another user's notifications.
 *  - Internal notification `id` is stripped by sanitization.
 *  - The `link` field is included (it's an app-relative path like
 *    "/student/documents", safe to share with the LLM).
 *
 * DATA SOURCE: `Notification` (queried by `userId` derived from
 * the authenticated student's session).
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AiTool, ToolContext, ToolResult } from "./types";
import { authorizeStudentOnly, ok, fail, notFound, internalError } from "./_helpers";

export const getStudentNotifications: AiTool = {
  name: "getStudentNotifications",
  description:
    "Get the student's recent and unread notifications (document updates, application status changes, appointment reminders, payment confirmations, messages). Returns unread count + the 10 most recent notifications. No parameters needed.",
  parameters: z.object({}).strict(),

  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const authError = authorizeStudentOnly(ctx);
    if (authError) return fail(authError);

    try {
      // Step 1: Resolve the student's userId from ctx.studentId.
      // Notifications are keyed by userId, not studentId — so we
      // MUST verify the student exists + get their userId.
      const student = await prisma.student.findFirst({
        where: { id: ctx.studentId, deletedAt: null },
        select: { userId: true },
      });

      if (!student) {
        return fail(notFound("Student"));
      }

      // Step 2: Query notifications by the student's userId.
      // This is the authorization boundary — we only query notifications
      // belonging to THIS student's user account.
      const [unreadCount, recent] = await Promise.all([
        prisma.notification.count({
          where: {
            userId: student.userId,
            readAt: null,
          },
        }),
        prisma.notification.findMany({
          where: { userId: student.userId },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

      const data = {
        unreadCount,
        recent: recent.map((n) => ({
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link,
          isRead: n.readAt !== null,
          createdAt: n.createdAt.toISOString(),
        })),
      };

      return ok(data);
    } catch (err) {
      return fail(internalError("getStudentNotifications", err));
    }
  },
};
