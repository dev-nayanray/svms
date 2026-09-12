import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentProfileService } from "@/lib/services/student-profile";
import { englishProficiencyUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/student/profile/english-proficiencies/[id]
 *
 * Update one English-proficiency record. Ownership is re-verified
 * server-side before the write.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const input = englishProficiencyUpdateSchema.parse(await req.json());
    const updated = await studentProfileService.updateEnglishProficiency(
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
 * DELETE /api/student/profile/english-proficiencies/[id]
 *
 * Remove an English-proficiency record. Foreign records return 404
 * so existence is never leaked.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    await studentProfileService.deleteEnglishProficiency(g.student.id, id, g.userId);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
