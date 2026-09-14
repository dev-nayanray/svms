import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentProfileService } from "@/lib/services/student-profile";
import { academicRecordUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/student/profile/academic-records/[id]
 *
 * Update one academic record. The record id comes from the URL; the
 * studentId is resolved from the session inside the service. The
 * service refuses to touch a record that doesn't belong to the caller
 * — ownership is re-checked server-side before the write.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const input = academicRecordUpdateSchema.parse(await req.json());
    const updated = await studentProfileService.updateAcademicRecord(
      g.student.id,
      id,
      input,
      g.userId
    );
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/student/profile/academic-records/[id]
 *
 * Remove an academic record. Ownership is verified inside the service
 * before deletion; foreign records return 404, not 403, so the existence
 * of other students' records is never leaked.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    await studentProfileService.deleteAcademicRecord(g.student.id, id, g.userId);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
