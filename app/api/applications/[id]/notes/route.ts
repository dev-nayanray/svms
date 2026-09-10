import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const noteSchema = z.object({
  body: z.string().min(1, "Note is required"),
  visibility: z.enum(["INTERNAL", "STUDENT"]).default("INTERNAL"),
});

/** Add a note to an application. INTERNAL notes are never exposed to students. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("applications.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = noteSchema.parse(await req.json());

    const application = await prisma.application.findFirst({ where: { id, deletedAt: null } });
    if (!application) throw notFound("Application");

    const note = await prisma.note.create({
      data: {
        studentId: application.studentId,
        applicationId: id,
        authorId: g.user.id,
        body: body.body,
        visibility: body.visibility,
      },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "application.note_added",
      entity: "Application",
      entityId: id,
      newValue: { visibility: body.visibility },
    });
    return ok(note, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
