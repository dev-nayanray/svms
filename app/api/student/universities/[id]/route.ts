import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { isUniversityVisibleToStudent } from "@/lib/constants/universities";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Student-facing university detail endpoint. Returns the same shape as the
 * admin detail page (courses, intakes, requirements, application info) but
 * ONLY for universities that pass the student-visibility rule. Internal
 * administrative fields (`deletedAt`, `deletedBy`, internal `_count`)
 * are stripped from the response.
 *
 * The route also marks whether the requesting student has favorited the
 * university so the UI can render the heart state without an extra call.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("universities.read");
    if (g.error) return g.error;
    const { id } = await params;

    const university = await prisma.university.findFirst({
      where: { id },
      include: {
        country: { select: { id: true, name: true, code: true, flag: true, currency: true } },
        courses: {
          where: { deletedAt: null, status: "ACTIVE" },
          orderBy: [{ degreeLevel: "asc" }, { name: "asc" }],
          include: {
            intakes: {
              where: { status: "ACTIVE" },
              orderBy: [{ year: "asc" }, { month: "asc" }],
            },
          },
        },
      },
    });

    if (!university || !isUniversityVisibleToStudent(university)) {
      throw notFound("University");
    }

    // Active intakes flattened for the Intakes tab.
    const intakes = university.courses.flatMap((c) =>
      c.intakes.map((i) => ({
        id: i.id,
        name: i.name,
        month: i.month,
        year: i.year,
        deadline: i.deadline,
        courseName: c.name,
        degreeLevel: c.degreeLevel,
      })),
    );

    // Document + visa requirements relevant to this country.
    const [documentRequirements, visaRequirements] = await Promise.all([
      prisma.documentRequirement.findMany({
        where: {
          status: "ACTIVE",
          appliesTo: { in: ["APPLICATION", "VISA", "PROFILE"] },
          OR: [{ countryId: university.countryId }, { countryId: null }],
        },
        orderBy: [{ appliesTo: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          required: true,
          appliesTo: true,
        },
      }),
      prisma.visaRequirement.findMany({
        where: {
          status: "ACTIVE",
          countryId: university.countryId,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          required: true,
        },
      }),
    ]);

    // Favorited state for the current student.
    let isFavorite = false;
    if (g.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: g.user.id },
        select: { id: true },
      });
      if (student) {
        const fav = await prisma.universityFavorite.findUnique({
          where: {
            studentId_universityId: {
              studentId: student.id,
              universityId: university.id,
            },
          },
          select: { id: true },
        });
        isFavorite = !!fav;
      }
    }

    // Has the student already requested counseling for this university?
    let counselingRequested = false;
    let counselingRequestStatus: string | null = null;
    if (g.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: g.user.id },
        select: { id: true },
      });
      if (student) {
        const existing = await prisma.counselingRequest.findFirst({
          where: { studentId: student.id, universityId: university.id },
          orderBy: { createdAt: "desc" },
          select: { status: true },
        });
        if (existing) {
          counselingRequested = true;
          counselingRequestStatus = existing.status;
        }
      }
    }

    // Strip internal administrative fields before sending the public payload.
    const {
      deletedAt: _deletedAt,
      deletedBy: _deletedBy,
      ...publicUniversity
    } = university;
    void _deletedAt;
    void _deletedBy;

    return ok({
      ...publicUniversity,
      courses: publicUniversity.courses.map((c) => {
        const { deletedAt: _cd, deletedBy: _cb, intakes: _intakes, ...coursePublic } = c;
        void _cd;
        void _cb;
        void _intakes;
        return coursePublic;
      }),
      intakes,
      documentRequirements,
      visaRequirements,
      isFavorite,
      counselingRequested,
      counselingRequestStatus,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
