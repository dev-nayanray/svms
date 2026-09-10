import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { COURSE_DEGREE_LEVELS } from "@/lib/constants/courses";

/**
 * Returns the filter options for the student course discovery UI:
 * the list of countries, universities, degree levels, and active intakes
 * that have at least one student-visible course, plus the tuition-fee
 * range (min + max) used to set the tuition-filter slider bounds.
 *
 * Aggregate-only response — no course records are leaked.
 */
export async function GET() {
  try {
    const g = await guard("courses.read");
    if (g.error) return g.error;

    // Visibility chain expressed at the DB level so the metadata only
    // reflects options a student could actually select and get results.
    const visibleCourseWhere = {
      deletedAt: null,
      status: "ACTIVE",
      university: {
        deletedAt: null,
        status: "ACTIVE",
        country: { deletedAt: null, status: "ACTIVE" },
      },
    };

    const [countries, universities, intakes, tuitionRange] = await Promise.all([
      prisma.country.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          universities: {
            some: {
              deletedAt: null,
              status: "ACTIVE",
              courses: { some: { deletedAt: null, status: "ACTIVE" } },
            },
          },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, flag: true },
      }),
      prisma.university.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          country: { deletedAt: null, status: "ACTIVE" },
          courses: { some: { deletedAt: null, status: "ACTIVE" } },
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          logo: true,
          country: { select: { id: true, name: true } },
        },
      }),
      prisma.intake.findMany({
        where: {
          status: "ACTIVE",
          course: visibleCourseWhere,
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        select: {
          id: true,
          name: true,
          month: true,
          year: true,
          deadline: true,
          course: {
            select: {
              id: true,
              name: true,
              degreeLevel: true,
              university: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.course.aggregate({
        where: visibleCourseWhere,
        _min: { tuitionFee: true },
        _max: { tuitionFee: true },
      }),
    ]);

    return ok({
      countries,
      universities,
      degreeLevels: COURSE_DEGREE_LEVELS,
      intakes: intakes.map((i) => ({
        id: i.id,
        name: i.name,
        month: i.month,
        year: i.year,
        deadline: i.deadline,
        courseId: i.course.id,
        courseName: i.course.name,
        degreeLevel: i.course.degreeLevel,
        universityId: i.course.university.id,
        universityName: i.course.university.name,
      })),
      tuitionMin: tuitionRange._min.tuitionFee,
      tuitionMax: tuitionRange._max.tuitionFee,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
