import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentProfileService } from "@/lib/services/student-profile";
import { englishProficiencyCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/profile/english-proficiencies
 *
 * Add an English-proficiency record (IELTS, TOEFL, PTE, DUOLINGO, OTHER)
 * to the caller's own profile. The studentId is taken from the session.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const input = englishProficiencyCreateSchema.parse(await req.json());
    const record = await studentProfileService.addEnglishProficiency(g.student.id, input, g.userId);
    return ok(record, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
