import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentMessageService } from "@/lib/services/student-messages";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const sendBodySchema = z.object({
  body: z.string().min(1, "Message body is required").max(5000, "Message too long"),
  attachmentUrl: z.string().max(500).optional(),
});

/**
 * POST /api/student/messages/[id]/messages
 *
 * Send a message in a conversation. The sender is the student
 * (senderId = student's userId from the session). The conversation
 * must belong to the caller (ownership verified inside the service).
 *
 * Body: { body: string, attachmentUrl?: string }
 *
 * The message is created, the conversation's lastMessageAt is
 * updated, and the counselor is notified via the Notification
 * system. The action is audit-logged.
 *
 * Foreign `conversationId` → 404 (NOT_FOUND, never 403).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const raw = await req.json();
    const parsed = sendBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid message", 422, {
        fields: { body: parsed.error.issues[0]?.message ?? "Invalid" },
      });
    }

    const message = await studentMessageService.sendMessage(
      g.student.id,
      id,
      parsed.data.body,
      parsed.data.attachmentUrl,
    );
    return ok({ message }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
