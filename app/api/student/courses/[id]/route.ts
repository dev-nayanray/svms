import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { isCourseVisibleToStudent, collectEnglishRequirements } from "@/lib/constants/courses";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Student-facing course detail endpoint. Returns the full course payload
 * (incl. intakes, university, country, English-test requirements,
 * academic requirements, application deadline) but ONLY for courses that
 * pass the student-visibility rule (course + university + country all
 * ACTIVE and non-archived).
 *
 * Internal administrative fields (`deletedAt`, `deletedBy`) are stripped
 * from the response. The route also surfaces whether the requesting
 * student has already requested counseling for this course's university
 * so the UI can disable the duplicate-action button without an extra call.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("courses.read");
    if (g.error) return g.error;
    const { id } = await params;

    const course = await prisma.course.findFirst({
      where: { id },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            logo: true,
            website: true,
            city: true,
            country: {
              select: { id: true, name: true, code: true, flag: true, currency: true },
            },
          },
        },
        intakes: {
          where: { status: "ACTIVE" },
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
      },
    });

    if (!course || !isCourseVisibleToStudent(course)) {
      throw notFound("Course");
    }

    // Resolve the student's counseling-request state for this course's
    // university so the UI can show "Request pending" without a second call.
    let counselingRequested = false;
    let counselingRequestStatus: string | null = null;
    if (g.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: g.user.id },
        select: { id: true },
      });
      if (student) {
        const existing = await prisma.counselingRequest.findFirst({
          where: {
            studentId: student.id,
            universityId: course.universityId,
          },
          orderBy: { createdAt: "desc" },
          select: { status: true },
        });
        if (existing) {
          counselingRequested = true;
          counselingRequestStatus = existing.status;
        }
      }
    }

    // Strip internal admin fields before sending the public payload.
    const {
      deletedAt: _deletedAt,
      deletedBy: _deletedBy,
      ...publicCourse
    } = course;
    void _deletedAt;
    void _deletedBy;

    return ok({
      ...publicCourse,
      englishRequirementsList: collectEnglishRequirements(publicCourse),
      counselingRequested,
      counselingRequestStatus,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
