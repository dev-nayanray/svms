import { EventEmitter } from "node:events";

/**
 * In-memory event bus for real-time Student Panel updates.
 *
 * DESIGN
 * ======
 *
 * When an admin/employee/system action affects a student (counselor sends
 * a message, document is approved, appointment is confirmed, task is
 * assigned, application stage changes), the service publishes an event to
 * this bus. The SSE endpoint at `/api/student/events` subscribes to the
 * bus filtered by `studentId` and streams events to the connected client.
 *
 * The client (StudentRealtimeProvider) listens to the stream and:
 *  - Invalidates the relevant TanStack Query cache (instant refetch)
 *  - Shows a toast notification for important events
 *  - Updates the unread count badge live
 *
 * This replaces the previous polling pattern (5s/30s/60s intervals) with
 * true real-time push — events arrive in milliseconds, not seconds.
 *
 * MULTI-INSTANCE CAVEAT
 * =====================
 *
 * This bus is in-process — it only works for single-instance deployments
 * (one Node.js process). For serverless / multi-replica / Kubernetes with
 * >1 replica, replace this with Redis pub/sub:
 *
 *   // publisher (in any service):
 *   await redis.publish(`student:${studentId}`, JSON.stringify(event));
 *
 *   // subscriber (in the SSE endpoint):
 *   await redis.subscribe(`student:${studentId}`, (msg) => {
 *     controller.enqueue(encode(msg));
 *   });
 *
 * The event shape (`type`, `studentId`, `payload`) stays the same — only
 * the transport layer changes.
 */

export type StudentEventType =
  | "message_received"
  | "notification_created"
  | "appointment_updated"
  | "task_updated"
  | "document_reviewed"
  | "application_updated"
  | "payment_received"
  | "invoice_updated"
  | "visa_updated";

export type StudentEvent = {
  /** The event type — drives client-side invalidation + toast. */
  type: StudentEventType;
  /** The student this event applies to. The SSE endpoint filters by this. */
  studentId: string;
  /** Event-specific payload (message preview, document name, etc.). */
  payload: unknown;
};

class StudentEventBus extends EventEmitter {
  constructor() {
    super();
    // Support many concurrent student SSE connections without warning.
    this.setMaxListeners(1000);
  }

  /**
   * Publish an event to a specific student. The SSE endpoint subscribed
   * to this student's channel will receive it and stream to the client.
   */
  publish(event: StudentEvent): void {
    this.emit(`student:${event.studentId}`, event);
  }

  /**
   * Subscribe to all events for a specific student. Returns an
   * unsubscribe function — the SSE endpoint MUST call this on connection
   * close to prevent memory leaks.
   */
  subscribe(
    studentId: string,
    handler: (event: StudentEvent) => void,
  ): () => void {
    const channel = `student:${studentId}`;
    this.on(channel, handler);
    return () => {
      this.off(channel, handler);
    };
  }
}

/**
 * Singleton bus. Imported by:
 *  - `lib/services/notification.ts` (publishes notification_created)
 *  - `lib/services/student-messages.ts` (publishes message_received)
 *  - `app/api/student/events/route.ts` (subscribes)
 *  - Any service that wants to push a real-time event
 */
export const studentEventBus = new StudentEventBus();

/**
 * Convenience helper for services that just want to publish a single
 * event without constructing the full object. Mirrors the shape used
 * by the SSE endpoint on the client side.
 */
export function publishStudentEvent(
  studentId: string,
  type: StudentEventType,
  payload: unknown,
): void {
  studentEventBus.publish({ type, studentId, payload });
}
