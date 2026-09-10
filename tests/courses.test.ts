import { describe, it, expect } from "vitest";
import {
  COURSE_DEGREE_LEVELS,
  COURSE_DEGREE_LABELS,
  STUDENT_COURSE_SORTS,
  INTAKE_URGENCY_THRESHOLDS,
  isCourseVisibleToStudent,
  buildStudentCourseWhere,
  resolveCourseOrderBy,
  intakeStartDate,
  formatShortDate,
  intakeDeadlineUrgency,
  formatTuitionFee,
  collectEnglishRequirements,
  hasOpenIntake,
} from "@/lib/constants/courses";
import {
  studentCourseQuerySchema,
  studentIntakeQuerySchema,
  courseSchema,
} from "@/lib/validations";

describe("course enums", () => {
  it("exposes the canonical degree levels", () => {
    expect(COURSE_DEGREE_LEVELS).toEqual([
      "FOUNDATION",
      "BACHELOR",
      "MASTER",
      "PHD",
      "DIPLOMA",
    ]);
  });

  it("labels every degree level", () => {
    for (const level of COURSE_DEGREE_LEVELS) {
      expect(typeof COURSE_DEGREE_LABELS[level]).toBe("string");
      expect(COURSE_DEGREE_LABELS[level].length).toBeGreaterThan(0);
    }
  });

  it("exposes a stable sort allow-list", () => {
    expect(STUDENT_COURSE_SORTS).toEqual([
      "name",
      "tuitionFee",
      "degreeLevel",
      "createdAt",
    ]);
  });

  it("urgency thresholds are sane (urgent < soon)", () => {
    expect(INTAKE_URGENCY_THRESHOLDS.urgentDays).toBeLessThan(
      INTAKE_URGENCY_THRESHOLDS.soonDays,
    );
  });
});

describe("isCourseVisibleToStudent", () => {
  const activeUni = {
    status: "ACTIVE",
    deletedAt: null,
    country: { status: "ACTIVE", deletedAt: null },
  };

  it("returns true when course + university + country are all ACTIVE", () => {
    expect(
      isCourseVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        university: activeUni,
      }),
    ).toBe(true);
  });

  it("returns false for an INACTIVE course", () => {
    expect(
      isCourseVisibleToStudent({
        status: "INACTIVE",
        deletedAt: null,
        university: activeUni,
      }),
    ).toBe(false);
  });

  it("returns false for a soft-deleted course", () => {
    expect(
      isCourseVisibleToStudent({
        status: "ACTIVE",
        deletedAt: new Date(),
        university: activeUni,
      }),
    ).toBe(false);
  });

  it("returns false when the parent university is INACTIVE", () => {
    expect(
      isCourseVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        university: { ...activeUni, status: "INACTIVE" },
      }),
    ).toBe(false);
  });

  it("returns false when the parent university is soft-deleted", () => {
    expect(
      isCourseVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        university: { ...activeUni, deletedAt: new Date() },
      }),
    ).toBe(false);
  });

  it("returns false when the grandparent country is INACTIVE", () => {
    expect(
      isCourseVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        university: {
          ...activeUni,
          country: { status: "INACTIVE", deletedAt: null },
        },
      }),
    ).toBe(false);
  });

  it("returns false when the grandparent country is soft-deleted", () => {
    expect(
      isCourseVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        university: {
          ...activeUni,
          country: { status: "ACTIVE", deletedAt: new Date() },
        },
      }),
    ).toBe(false);
  });

  it("returns false when the university relation is missing", () => {
    expect(
      isCourseVisibleToStudent({ status: "ACTIVE", deletedAt: null }),
    ).toBe(false);
    expect(
      isCourseVisibleToStudent({ status: "ACTIVE", deletedAt: null, university: null }),
    ).toBe(false);
  });
});

describe("buildStudentCourseWhere", () => {
  it("always enforces the visibility chain (course + university + country)", () => {
    const where = buildStudentCourseWhere({});
    expect(where.AND).toEqual([
      { deletedAt: null, status: "ACTIVE" },
      {
        university: {
          deletedAt: null,
          status: "ACTIVE",
          country: { deletedAt: null, status: "ACTIVE" },
        },
      },
    ]);
  });

  it("searches across course name, university name, and country name", () => {
    const where = buildStudentCourseWhere({ search: "Manchester" });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "Manchester", mode: "insensitive" } },
        { university: { name: { contains: "Manchester", mode: "insensitive" } } },
        {
          university: {
            country: { name: { contains: "Manchester", mode: "insensitive" } },
          },
        },
      ],
    });
  });

  it("trims whitespace from search before filtering", () => {
    const where = buildStudentCourseWhere({ search: "  Computer  " });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "Computer", mode: "insensitive" } },
        { university: { name: { contains: "Computer", mode: "insensitive" } } },
        {
          university: {
            country: { name: { contains: "Computer", mode: "insensitive" } },
          },
        },
      ],
    });
  });

  it("applies country, university, and degree filters as nested AND clauses", () => {
    const where = buildStudentCourseWhere({
      countryId: "c1",
      universityId: "u1",
      degreeLevel: "MASTER",
    });
    expect(where.AND).toContainEqual({ university: { countryId: "c1" } });
    expect(where.AND).toContainEqual({ universityId: "u1" });
    expect(where.AND).toContainEqual({ degreeLevel: "MASTER" });
  });

  it("builds a tuition range filter with both bounds inclusive", () => {
    const where = buildStudentCourseWhere({ tuitionMin: 10000, tuitionMax: 50000 });
    expect(where.AND).toContainEqual({
      tuitionFee: { gte: 10000, lte: 50000 },
    });
  });

  it("supports a single-sided tuition range (min only)", () => {
    const where = buildStudentCourseWhere({ tuitionMin: 20000 });
    expect(where.AND).toContainEqual({ tuitionFee: { gte: 20000 } });
  });

  it("supports a single-sided tuition range (max only)", () => {
    const where = buildStudentCourseWhere({ tuitionMax: 30000 });
    expect(where.AND).toContainEqual({ tuitionFee: { lte: 30000 } });
  });

  it("filters by intake membership with an active-intake guard", () => {
    const where = buildStudentCourseWhere({ intakeId: "intake-1" });
    expect(where.AND).toContainEqual({
      intakes: { some: { id: "intake-1", status: "ACTIVE" } },
    });
  });

  it("englishTest=ielts filters to courses with IELTS populated", () => {
    const where = buildStudentCourseWhere({ englishTest: "ielts" });
    expect(where.AND).toContainEqual({ ieltsRequirement: { not: null } });
  });

  it("englishTest=toefl filters to courses with TOEFL populated", () => {
    const where = buildStudentCourseWhere({ englishTest: "toefl" });
    expect(where.AND).toContainEqual({ toeflRequirement: { not: null } });
  });

  it("englishTest=pte filters to courses with PTE populated", () => {
    const where = buildStudentCourseWhere({ englishTest: "pte" });
    expect(where.AND).toContainEqual({ pteRequirement: { not: null } });
  });

  it("englishTest=any matches courses with ANY English-test requirement", () => {
    const where = buildStudentCourseWhere({ englishTest: "any" });
    expect(where.AND).toContainEqual({
      OR: [
        { ieltsRequirement: { not: null } },
        { toeflRequirement: { not: null } },
        { pteRequirement: { not: null } },
      ],
    });
  });

  it("does not add an englishTest clause when the filter is missing", () => {
    const where = buildStudentCourseWhere({});
    const json = JSON.stringify(where);
    expect(json).not.toContain("ieltsRequirement");
    expect(json).not.toContain("toeflRequirement");
    expect(json).not.toContain("pteRequirement");
  });
});

describe("resolveCourseOrderBy", () => {
  it("defaults to name asc", () => {
    expect(resolveCourseOrderBy()).toEqual({ name: "asc" });
    expect(resolveCourseOrderBy("unknown")).toEqual({ name: "asc" });
  });

  it("sorts tuition ascending (cheapest first)", () => {
    expect(resolveCourseOrderBy("tuitionFee")).toEqual({ tuitionFee: "asc" });
  });

  it("sorts degreeLevel ascending", () => {
    expect(resolveCourseOrderBy("degreeLevel")).toEqual({ degreeLevel: "asc" });
  });

  it("sorts createdAt descending (newest first)", () => {
    expect(resolveCourseOrderBy("createdAt")).toEqual({ createdAt: "desc" });
  });

  it("sorts name ascending", () => {
    expect(resolveCourseOrderBy("name")).toEqual({ name: "asc" });
  });
});

describe("intakeStartDate", () => {
  it("derives the first day of the intake month in UTC", () => {
    const d = intakeStartDate(9, 2026);
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(8); // September = month 8
    expect(d!.getUTCDate()).toBe(1);
  });

  it("handles January (month 1)", () => {
    const d = intakeStartDate(1, 2027);
    expect(d!.getUTCMonth()).toBe(0);
  });

  it("returns null for missing month or year", () => {
    expect(intakeStartDate(null, 2026)).toBeNull();
    expect(intakeStartDate(9, null)).toBeNull();
    expect(intakeStartDate(null, null)).toBeNull();
  });

  it("returns null for out-of-range month", () => {
    expect(intakeStartDate(0, 2026)).toBeNull();
    expect(intakeStartDate(13, 2026)).toBeNull();
  });

  it("returns null for out-of-range year", () => {
    expect(intakeStartDate(9, 1800)).toBeNull();
    expect(intakeStartDate(9, 3001)).toBeNull();
  });
});

describe("formatShortDate", () => {
  it("returns em-dash for nullish input", () => {
    expect(formatShortDate(null)).toBe("—");
    expect(formatShortDate(undefined)).toBe("—");
  });

  it("returns em-dash for invalid dates", () => {
    expect(formatShortDate(new Date("not-a-date"))).toBe("—");
  });

  it("formats a valid date as DD Mon YYYY", () => {
    const d = new Date(Date.UTC(2026, 8, 1));
    const out = formatShortDate(d);
    expect(out).toMatch(/01 Sep\w* 2026/);
  });

  it("accepts ISO strings", () => {
    const out = formatShortDate("2026-09-01T00:00:00.000Z");
    expect(out).toMatch(/01 Sep\w* 2026/);
  });
});

describe("intakeDeadlineUrgency", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const daysFromNow = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  it("returns 'none' for a null deadline", () => {
    expect(intakeDeadlineUrgency(null, now)).toBe("none");
    expect(intakeDeadlineUrgency(undefined, now)).toBe("none");
  });

  it("returns 'urgent' for deadlines within 7 days", () => {
    expect(intakeDeadlineUrgency(daysFromNow(1), now)).toBe("urgent");
    expect(intakeDeadlineUrgency(daysFromNow(7), now)).toBe("urgent");
  });

  it("returns 'soon' for deadlines between 8 and 30 days", () => {
    expect(intakeDeadlineUrgency(daysFromNow(8), now)).toBe("soon");
    expect(intakeDeadlineUrgency(daysFromNow(30), now)).toBe("soon");
  });

  it("returns 'normal' for deadlines more than 30 days away", () => {
    expect(intakeDeadlineUrgency(daysFromNow(31), now)).toBe("normal");
    expect(intakeDeadlineUrgency(daysFromNow(365), now)).toBe("normal");
  });

  it("returns 'past' for deadlines that have already passed", () => {
    expect(intakeDeadlineUrgency(daysFromNow(-1), now)).toBe("past");
    expect(intakeDeadlineUrgency(daysFromNow(-30), now)).toBe("past");
  });

  it("returns 'none' for invalid date input", () => {
    expect(intakeDeadlineUrgency(new Date("not-a-date"), now)).toBe("none");
  });

  it("uses the current time when 'now' is omitted", () => {
    // Just verify it doesn't throw and returns one of the expected values.
    const result = intakeDeadlineUrgency(new Date(Date.now() + 3 * 86400000));
    expect(["urgent", "soon", "normal", "past", "none"]).toContain(result);
  });
});

describe("formatTuitionFee", () => {
  it("returns em-dash for nullish input", () => {
    expect(formatTuitionFee(null)).toBe("—");
    expect(formatTuitionFee(undefined)).toBe("—");
  });

  it("formats USD with no decimals", () => {
    expect(formatTuitionFee(32500, "USD")).toMatch(/32,500/);
    expect(formatTuitionFee(32500, "USD")).not.toMatch(/\.\d+/);
  });

  it("falls back to a plain number for invalid currency codes", () => {
    const out = formatTuitionFee(32500, "NOTACURRENCY");
    expect(out).toContain("32,500");
  });

  it("defaults currency to USD when not provided", () => {
    expect(formatTuitionFee(5000)).toMatch(/5,000/);
  });
});

describe("collectEnglishRequirements", () => {
  it("returns an empty array when no requirements are populated", () => {
    expect(collectEnglishRequirements({})).toEqual([]);
    expect(
      collectEnglishRequirements({
        ieltsRequirement: null,
        toeflRequirement: null,
        pteRequirement: null,
      }),
    ).toEqual([]);
  });

  it("collects all three populated requirements with stable labels", () => {
    const out = collectEnglishRequirements({
      ieltsRequirement: "6.5 overall",
      toeflRequirement: "90 iBT",
      pteRequirement: "62 overall",
    });
    expect(out).toHaveLength(3);
    expect(out.map((e) => e.label)).toEqual(["IELTS", "TOEFL", "PTE Academic"]);
    expect(out.map((e) => e.test)).toEqual(["ielts", "toefl", "pte"]);
  });

  it("omits null/empty requirements but keeps populated ones", () => {
    const out = collectEnglishRequirements({
      ieltsRequirement: "6.5",
      toeflRequirement: null,
      pteRequirement: "62",
    });
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.test)).toEqual(["ielts", "pte"]);
  });
});

describe("hasOpenIntake", () => {
  const past = new Date(Date.now() - 86400000);
  const future = new Date(Date.now() + 30 * 86400000);

  it("returns false for an empty or null intake list", () => {
    expect(hasOpenIntake([])).toBe(false);
    expect(hasOpenIntake(null)).toBe(false);
    expect(hasOpenIntake(undefined)).toBe(false);
  });

  it("returns true when at least one active intake has a future deadline", () => {
    expect(
      hasOpenIntake([
        { status: "ACTIVE", deadline: past },
        { status: "ACTIVE", deadline: future },
      ]),
    ).toBe(true);
  });

  it("returns true when an active intake has no deadline (open)", () => {
    expect(
      hasOpenIntake([{ status: "ACTIVE", deadline: null }]),
    ).toBe(true);
    expect(hasOpenIntake([{ status: "ACTIVE", deadline: undefined }])).toBe(true);
  });

  it("returns false when all active intakes have past deadlines", () => {
    expect(
      hasOpenIntake([
        { status: "ACTIVE", deadline: past },
        { status: "ACTIVE", deadline: past },
      ]),
    ).toBe(false);
  });

  it("ignores INACTIVE intakes even if they have future deadlines", () => {
    expect(
      hasOpenIntake([{ status: "INACTIVE", deadline: future }]),
    ).toBe(false);
  });
});

describe("studentCourseQuerySchema", () => {
  it("parses a complete course filter query", () => {
    const out = studentCourseQuerySchema.parse({
      page: 2,
      pageSize: 12,
      search: "Computer",
      countryId: "c1",
      universityId: "u1",
      degreeLevel: "MASTER",
      tuitionMin: 10000,
      tuitionMax: 50000,
      intakeId: "i1",
      englishTest: "ielts",
      sortBy: "tuitionFee",
    });
    expect(out.page).toBe(2);
    expect(out.degreeLevel).toBe("MASTER");
    expect(out.tuitionMin).toBe(10000);
    expect(out.tuitionMax).toBe(50000);
    expect(out.englishTest).toBe("ielts");
    expect(out.sortBy).toBe("tuitionFee");
  });

  it("defaults page and pageSize when missing", () => {
    const out = studentCourseQuerySchema.parse({});
    expect(out.page).toBe(1);
    expect(out.pageSize).toBe(20);
  });

  it("rejects negative page numbers", () => {
    expect(studentCourseQuerySchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it("rejects negative tuition bounds", () => {
    expect(
      studentCourseQuerySchema.safeParse({ tuitionMin: -100 }).success,
    ).toBe(false);
    expect(
      studentCourseQuerySchema.safeParse({ tuitionMax: -1 }).success,
    ).toBe(false);
  });

  it("rejects unknown englishTest values", () => {
    expect(
      studentCourseQuerySchema.safeParse({ englishTest: "duolingo" }).success,
    ).toBe(false);
  });

  it("rejects unknown sortBy values", () => {
    expect(
      studentCourseQuerySchema.safeParse({ sortBy: "ranking" }).success,
    ).toBe(false);
  });

  it("accepts the 'any' englishTest meta-filter", () => {
    expect(
      studentCourseQuerySchema.safeParse({ englishTest: "any" }).success,
    ).toBe(true);
  });
});

describe("studentIntakeQuerySchema", () => {
  it("parses a complete intake filter query", () => {
    const out = studentIntakeQuerySchema.parse({
      page: 1,
      pageSize: 20,
      search: "September",
      countryId: "c1",
      universityId: "u1",
      courseId: "course-1",
      upcomingOnly: "true",
    });
    expect(out.upcomingOnly).toBe(true);
    expect(out.courseId).toBe("course-1");
  });

  it("omits the status field (intakes use their own status filter)", () => {
    const out = studentIntakeQuerySchema.parse({ status: "ACTIVE" });
    expect(out).not.toHaveProperty("status");
  });

  it("defaults page and pageSize when missing", () => {
    const out = studentIntakeQuerySchema.parse({});
    expect(out.page).toBe(1);
    expect(out.pageSize).toBe(20);
  });

  it("accepts upcomingOnly as a boolean", () => {
    expect(
      studentIntakeQuerySchema.safeParse({ upcomingOnly: true }).success,
    ).toBe(true);
    expect(
      studentIntakeQuerySchema.safeParse({ upcomingOnly: false }).success,
    ).toBe(true);
  });
});

describe("courseSchema (admin create, with new English-test fields)", () => {
  it("accepts the new ielts/toefl/pte fields", () => {
    const out = courseSchema.safeParse({
      universityId: "u1",
      name: "MSc Computer Science",
      degreeLevel: "MASTER",
      ieltsRequirement: "6.5 overall",
      toeflRequirement: "90 iBT",
      pteRequirement: "62 overall",
    });
    expect(out.success).toBe(true);
  });

  it("accepts a course with no English-test requirements", () => {
    expect(
      courseSchema.safeParse({
        universityId: "u1",
        name: "Foundation Year",
        degreeLevel: "FOUNDATION",
      }).success,
    ).toBe(true);
  });

  it("rejects English-test requirement strings longer than 200 chars", () => {
    const long = "a".repeat(201);
    expect(
      courseSchema.safeParse({
        universityId: "u1",
        name: "X",
        degreeLevel: "MASTER",
        ieltsRequirement: long,
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid degreeLevel", () => {
    expect(
      courseSchema.safeParse({
        universityId: "u1",
        name: "X",
        degreeLevel: "ASSOCIATE",
      }).success,
    ).toBe(false);
  });

  it("defaults status to ACTIVE", () => {
    const out = courseSchema.parse({
      universityId: "u1",
      name: "X",
      degreeLevel: "MASTER",
    });
    expect(out.status).toBe("ACTIVE");
  });
});
