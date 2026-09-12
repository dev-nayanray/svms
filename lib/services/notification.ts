import { prisma } from "@/lib/db";
import { publishStudentEvent } from "@/lib/realtime/event-bus";

/**
 * Central notification service. Every call to `push()`:
 *  1. Persists a Notification row (the source of truth — used by the
 *     notifications page, the unread count badge, etc.)
 *  2. Publishes a `notification_created` event to the in-memory event
 *     bus, which the SSE endpoint streams to the student's connected
 *     client. This is what makes the student panel "fully dynamic" —
 *     the student sees new notifications in milliseconds, not on the
 *     next 30s poll.
 *
 * The payload of the published event is the full notification object
 * (id, type, title, message, link, createdAt) plus the inferred
 * `studentId` — the client uses `type` to decide which queries to
 * invalidate (messages, documents, appointments, etc.).
 */
export const notifications = {
  async push(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    const row = await prisma.notification.create({ data: input });

    // Resolve the studentId for this user so we can publish to the
    // right SSE channel. If the user isn't a student (e.g. employee
    // notifications), the lookup returns null and we skip the publish
    // — the SSE endpoint is student-only.
    const student = await prisma.student.findFirst({
      where: { userId: input.userId, deletedAt: null },
      select: { id: true },
    });

    if (student) {
      publishStudentEvent(student.id, "notification_created", {
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        link: row.link,
        createdAt: row.createdAt,
      });
    }

    return row;
  },
};
