import { NextRequest } from "next/server";
import { studentApiGuard } from "@/lib/student/guard";
import { studentEventBus, type StudentEvent } from "@/lib/realtime/event-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/student/events — Server-Sent Events (SSE) endpoint.
 *
 * Opens a long-lived HTTP connection that streams real-time events to
 * the authenticated student's client.
 */
export async function GET(req: NextRequest) {
  const g = await studentApiGuard();
  if (!g.ok) return g.error;

  const studentId = g.student.id;
  const encoder = new TextEncoder();

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  function cleanup() {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (unsubscribe) unsubscribe();
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(event: StudentEvent) {
        if (closed) return;
        try {
          const line = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          // controller already closed — drop the event
        }
      }

      // Initial hello
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "connected", studentId })}\n\n`,
          ),
        );
      } catch {
        return;
      }

      // Subscribe to this student's events
      unsubscribe = studentEventBus.subscribe(studentId, send);

      // Heartbeat every 30s
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // stream closed — cleanup
          cleanup();
        }
      }, 30_000);

      // Cleanup on abort (client closed the connection)
      req.signal.addEventListener("abort", () => {
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      });
    },

    // Called when the consumer cancels the stream — proper cleanup
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate, private",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Frame-Options": "DENY",
    },
  });
}
