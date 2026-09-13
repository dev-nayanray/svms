import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { handlePhotoUpload } from "@/app/api/student/profile/photo/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/students/[id]/photo — admin uploads a student's profile photo.
 *
 * Uses the same handlePhotoUpload() as the student self-service route
 * to ensure consistent validation, storage, and audit logging.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("students.update");
    if (g.error) return g.error;

    const { id } = await params;
    const student = await prisma.student.findFirst({
      where: { id, deletedAt: null },
    });
    if (!student) return fail("NOT_FOUND", "Student not found", 404);

    return await handlePhotoUpload(
      student.id,
      g.user.id,
      req,
      "admin.student_photo_changed",
    );
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/students/[id]/photo — admin removes a student's photo.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("students.update");
    if (g.error) return g.error;

    const { id } = await params;
    const student = await prisma.student.findFirst({ where: { id, deletedAt: null } });
    if (!student) return fail("NOT_FOUND", "Student not found", 404);

    // Use the student-profile service to remove the photo
    const { studentProfileService } = await import("@/lib/services/student-profile");
    const updated = await studentProfileService.removeProfilePhoto(student, g.user.id);
    return ok(studentProfileService.toView(updated));
  } catch (err) {
    return handleApiError(err);
  }
}
