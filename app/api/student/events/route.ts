import { NextRequest } from "next/server";
import { studentApiGuard } from "@/lib/student/guard";
import { studentEventBus, type StudentEvent } from "@/lib/realtime/event-bus";

export const dynamic = "force-dynamic";
// SSE requires the Node.js runtime — edge runtime doesn't support
// long-lived streaming responses with backpressure the same way.
export const runtime = "nodejs";

// Prevent Next.js from timing out the request after the default 10s —
// SSE connections are long-lived by design. Set to 0 (no timeout).
export const maxDuration = 0;

/**
 * GET /api/student/events — Server-Sent Events (SSE) endpoint
 *
 * Opens a long-lived HTTP connection that streams real-time events to
 * the authenticated student's client. The client (StudentRealtimeProvider)
 * subscribes via `new EventSource("/api/student/events")` and listens
 * for events.
 *
 * EVENT FORMAT
 * ============
 *
 * Each event is sent as a standard SSE `data:` line containing a JSON
 * object:
 *
 *   data: {"type":"message_received","studentId":"...","payload":{...}}
 *
 * The client parses the JSON and dispatches based on `type`:
 *  - invalidate the relevant TanStack Query cache
 *  - show a toast notification
 *  - update the unread count badge live
 *
 * HEARTBEAT
 * =========
 *
 * A comment line (`: heartbeat\n\n`) is sent every 30 seconds to keep
 * the connection alive through proxies that would otherwise close idle
 * connections after 60-120s.
 *
 * CLEANUP
 * =======
 *
 * When the client disconnects (closes the tab, navigates away, network
 * drops), the request's `signal` is aborted. The handler unsubscribes
 * from the event bus to prevent memory leaks. If this isn't done, every
 * disconnected client would leak a listener and eventually hit the
 * EventEmitter max-listeners cap.
 *
 * SECURITY
 * ========
 *
 * The endpoint calls `studentApiGuard()` first — only authenticated
 * STUDENT roles can subscribe. The event bus filters by `studentId`
 * resolved from the session, so a student can never receive events
 * for another student's resources (defense in depth on top of the
 * bus being studentId-scoped).
 */
export async function GET(req: NextRequest) {
  const g = await studentApiGuard();
  if (!g.ok) return g.error;

  const studentId = g.student.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      function send(event: StudentEvent) {
        if (closed) return;
        try {
          const line = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          // controller already closed — drop the event
        }
      }

      // Initial hello — lets the client know the connection is live
      // and authenticated. The client uses this to flip the "Live"
      // indicator green.
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", studentId })}\n\n`,
        ),
      );

      // Subscribe to this student's events
      const unsubscribe = studentEventBus.subscribe(studentId, send);

      // Heartbeat every 30s — keeps the connection alive through
      // idle proxies and lets the client detect a dead connection
      // (if no heartbeat arrives for 60s, the client reconnects).
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // ignore
        }
      }, 30_000);

      // Cleanup on abort (client closed the connection)
      req.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      // Also cleanup if the stream is cancelled (rare, but possible
      // if the upstream proxy drops the connection without aborting
      // the request signal).
      controller.error = (err) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        console.error("[sse] stream error", err);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate, private",
      Connection: "keep-alive",
      // Disable Nginx buffering (if behind Nginx) so events are
      // flushed to the client immediately instead of batched.
      "X-Accel-Buffering": "no",
      // Don't allow framing — defense in depth.
      "X-Frame-Options": "DENY",
    },
  });
}
