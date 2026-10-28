import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

/**
 * DELETE /api/applications/[id]/notes/[noteId] — remove a case note.
 * Notes are operational records, not legal documents, so this is a hard
 * delete; the audit log keeps the trace of who removed what.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("applications.manage");
    if (g.error) return g.error;
    const { id, noteId } = await params;

    const note = await prisma.note.findFirst({
      where: { id: noteId, applicationId: id },
    });
    if (!note) throw notFound("Note");

    await prisma.note.delete({ where: { id: note.id } });

    const { ipAddress, userAgent } = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: "application.note_deleted",
      entity: "Application",
      entityId: id,
      oldValue: { noteId: note.id, body: note.body.slice(0, 200) },
      ipAddress,
      userAgent,
    });

    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
