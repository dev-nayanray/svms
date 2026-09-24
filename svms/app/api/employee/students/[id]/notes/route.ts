import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

const noteSchema = z.object({
  body: z.string().min(1, "Note body is required").max(5000, "Note too long (max 5000 chars)"),
  visibility: z.enum(["INTERNAL", "STUDENT"]).default("INTERNAL"),
  pinned: z.boolean().default(false),
});

/**
 * POST /api/employee/students/[id]/notes
 *
 * Adds a staff note to a student's record. The student is resolved from
 * the session via the case-ownership filter — a foreign student id returns
 * 404 (never 403) so ownership is never confirmed.
 *
 * Permissions:
 *  - students.update is required to author a note
 *  - INTERNAL visibility is the default — only STUDENT visibility surfaces
 *    in the student portal (when shipped)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
    if (!hasPermission(role, "students.update")) throw new HttpError(403, "FORBIDDEN", "Missing students.update permission");

    const { id: studentId } = await ctx.params;
    const body = noteSchema.parse(await req.json());

    // IDOR closure: resolve the student via the case-ownership filter so a
    // foreign id returns 404 (never 403).
    const ownerFilter = role === "ADMIN" ? {} : { assignedEmployee: { userId: session.user.id } };
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...ownerFilter },
      select: { id: true },
    });
    if (!student) throw new HttpError(404, "NOT_FOUND", "Student not found");

    const note = await prisma.note.create({
      data: {
        studentId,
        authorId: session.user.id,
        body: body.body,
        visibility: body.visibility,
        pinned: body.pinned,
      },
    });

    return ok(note, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
