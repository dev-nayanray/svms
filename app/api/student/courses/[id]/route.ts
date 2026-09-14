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

    // Defense-in-depth: enforce the student-visibility rule (course +
    // university + country all ACTIVE and not soft-deleted) at the DB
    // level AND in the post-fetch isCourseVisibleToStudent() check.
    // The university + country projections include status + deletedAt
    // so the post-fetch check has the fields it needs to evaluate the
    // full chain.
    const course = await prisma.course.findFirst({
      where: {
        id,
        deletedAt: null,
        status: "ACTIVE",
        university: {
          deletedAt: null,
          status: "ACTIVE",
          country: { deletedAt: null, status: "ACTIVE" },
        },
      },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            logo: true,
            website: true,
            city: true,
            status: true,
            deletedAt: true,
            country: {
              select: {
                id: true,
                name: true,
                code: true,
                flag: true,
                currency: true,
                status: true,
                deletedAt: true,
              },
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
    // We also strip university.status + university.deletedAt and
    // country.status + country.deletedAt — they were only needed for
    // the post-fetch visibility check.
    const {
      deletedAt: _deletedAt,
      deletedBy: _deletedBy,
      university: {
        status: _us,
        deletedAt: _ud,
        country: { status: _cs, deletedAt: _cd, ...publicCountry },
        ...publicUniversity
      },
      ...publicCourse
    } = course;
    void _deletedAt;
    void _deletedBy;
    void _us;
    void _ud;
    void _cs;
    void _cd;

    return ok({
      ...publicCourse,
      university: { ...publicUniversity, country: publicCountry },
      englishRequirementsList: collectEnglishRequirements(publicCourse),
      counselingRequested,
      counselingRequestStatus,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
