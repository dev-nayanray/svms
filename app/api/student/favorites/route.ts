import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { favoriteToggleSchema } from "@/lib/validations";
import { isUniversityVisibleToStudent } from "@/lib/constants/universities";
import { auditLog } from "@/lib/services/audit";

/**
 * GET — list the current student's favorited universities. Returns only
 * universities that are still student-visible (an archived university stays
 * in the favorite row but is hidden from the list).
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("student.favorites");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const student = await prisma.student.findUnique({
      where: { userId: g.user.id },
      select: { id: true },
    });
    if (!student) return fail("NOT_FOUND", "Student profile not set up", 404);

    const includeHidden = sp.get("includeHidden") === "true";

    const favorites = await prisma.universityFavorite.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      include: {
        university: {
          include: {
            country: { select: { id: true, name: true, flag: true } },
            _count: { select: { courses: { where: { deletedAt: null, status: "ACTIVE" } } } },
          },
        },
      },
    });

    const data = favorites
      .filter((f) => includeHidden || isUniversityVisibleToStudent(f.university))
      .map((f) => {
        const { _count, ...u } = f.university;
        return {
          ...u,
          courseCount: _count.courses,
          favoritedAt: f.createdAt,
        };
      });

    return ok({ data });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST — toggle a university in/out of the current student's favorites.
 * Idempotent: posting twice removes the favorite. Returns the new
 * `isFavorite` state so the UI can update without a refetch.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("student.favorites");
    if (g.error) return g.error;

    const body = favoriteToggleSchema.parse(await req.json());
    const student = await prisma.student.findUnique({
      where: { userId: g.user.id },
      select: { id: true },
    });
    if (!student) return fail("NOT_FOUND", "Student profile not set up", 404);

    const university = await prisma.university.findFirst({
      where: { id: body.universityId },
      include: { country: true },
    });
    if (!university || !isUniversityVisibleToStudent(university)) {
      return fail("NOT_FOUND", "University not available", 404);
    }

    const existing = await prisma.universityFavorite.findUnique({
      where: {
        studentId_universityId: {
          studentId: student.id,
          universityId: body.universityId,
        },
      },
    });

    if (existing) {
      await prisma.universityFavorite.delete({ where: { id: existing.id } });
      await auditLog.record({
        userId: g.user.id,
        action: "university.unfavorited",
        entity: "University",
        entityId: body.universityId,
        oldValue: { studentId: student.id },
      });
      return ok({ isFavorite: false });
    }

    await prisma.universityFavorite.create({
      data: { studentId: student.id, universityId: body.universityId },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "university.favorited",
      entity: "University",
      entityId: body.universityId,
      newValue: { studentId: student.id },
    });
    return ok({ isFavorite: true });
  } catch (err) {
    return handleApiError(err);
  }
}
