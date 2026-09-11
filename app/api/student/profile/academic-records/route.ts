import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentProfileService } from "@/lib/services/student-profile";
import { academicRecordCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/profile/academic-records
 *
 * Add a new academic record (SSC/HSC/Diploma/Bachelor/Master/PHD/Other)
 * to the caller's own profile. The studentId is taken from the session
 * — the body never carries it.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const input = academicRecordCreateSchema.parse(await req.json());
    const record = await studentProfileService.addAcademicRecord(g.student.id, input, g.userId);
    return ok(record, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
