import { describe, it, expect } from "vitest";
import {
  COURSE_STATUSES,
  COURSE_STATUS_LABELS,
  ADMIN_COURSE_SORT_KEYS,
  ADMIN_INTAKE_SORT_KEYS,
  INTAKE_STATUSES,
  INTAKE_STATUS_LABELS,
  ENGLISH_TEST_FILTERS,
  buildAdminCourseWhere,
  buildAdminIntakeWhere,
  courseArchiveBlockReason,
  intakeArchiveBlockReason,
  formatTuition,
  intakeStartLabel,
} from "@/lib/constants/courses-admin";
import {
  courseSchema,
  courseUpdateSchema,
  intakeSchema,
  intakeUpdateSchema,
} from "@/lib/validations";

describe("admin course enums", () => {
  it("exposes exactly ACTIVE and INACTIVE for courses", () => {
    expect(COURSE_STATUSES).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("labels every course status", () => {
    expect(COURSE_STATUS_LABELS.ACTIVE).toBe("Active");
    expect(COURSE_STATUS_LABELS.INACTIVE).toBe("Inactive");
  });

  it("exposes a stable course sort allow-list", () => {
    expect(ADMIN_COURSE_SORT_KEYS).toEqual([
      "name",
      "tuitionFee",
      "degreeLevel",
      "status",
      "createdAt",
    ]);
  });

  it("exposes a stable intake sort allow-list", () => {
    expect(ADMIN_INTAKE_SORT_KEYS).toEqual([
      "name",
      "year",
      "month",
      "deadline",
      "status",
      "createdAt",
    ]);
  });

  it("exposes exactly ACTIVE and INACTIVE for intakes", () => {
    expect(INTAKE_STATUSES).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("labels every intake status", () => {
    expect(INTAKE_STATUS_LABELS.ACTIVE).toBe("Active");
    expect(INTAKE_STATUS_LABELS.INACTIVE).toBe("Inactive");
  });

  it("exposes the english-test filter values", () => {
    expect(ENGLISH_TEST_FILTERS).toEqual(["ielts", "toefl", "pte", "any"]);
  });
});

describe("buildAdminCourseWhere", () => {
  it("filters by deletedAt null when archived=false (default)", () => {
    const where = buildAdminCourseWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("filters by deletedAt not-null when archived=true", () => {
    const where = buildAdminCourseWhere({ archived: true });
    expect(where.AND).toContainEqual({ deletedAt: { not: null } });
  });

  it("applies status filter as an AND clause", () => {
    const where = buildAdminCourseWhere({ status: "ACTIVE" });
    expect(where.AND).toContainEqual({ status: "ACTIVE" });
  });

  it("applies degreeLevel filter as an AND clause", () => {
    const where = buildAdminCourseWhere({ degreeLevel: "MASTER" });
    expect(where.AND).toContainEqual({ degreeLevel: "MASTER" });
  });

  it("applies universityId filter as an AND clause", () => {
    const where = buildAdminCourseWhere({ universityId: "u1" });
    expect(where.AND).toContainEqual({ universityId: "u1" });
  });

  it("applies countryId filter via nested university join", () => {
    const where = buildAdminCourseWhere({ countryId: "c1" });
    expect(where.AND).toContainEqual({ university: { countryId: "c1" } });
  });

  it("searches across course name, university name, and country name", () => {
    const where = buildAdminCourseWhere({ search: "Manchester" });
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

  it("builds a tuition range filter with both bounds inclusive", () => {
    const where = buildAdminCourseWhere({ tuitionMin: 10000, tuitionMax: 50000 });
    expect(where.AND).toContainEqual({
      tuitionFee: { gte: 10000, lte: 50000 },
    });
  });

  it("supports a single-sided tuition range (min only)", () => {
    const where = buildAdminCourseWhere({ tuitionMin: 20000 });
    expect(where.AND).toContainEqual({ tuitionFee: { gte: 20000 } });
  });

  it("supports a single-sided tuition range (max only)", () => {
    const where = buildAdminCourseWhere({ tuitionMax: 30000 });
    expect(where.AND).toContainEqual({ tuitionFee: { lte: 30000 } });
  });

  it("englishTest=ielts filters to courses with IELTS populated", () => {
    const where = buildAdminCourseWhere({ englishTest: "ielts" });
    expect(where.AND).toContainEqual({ ieltsRequirement: { not: null } });
  });

  it("englishTest=toefl filters to courses with TOEFL populated", () => {
    const where = buildAdminCourseWhere({ englishTest: "toefl" });
    expect(where.AND).toContainEqual({ toeflRequirement: { not: null } });
  });

  it("englishTest=pte filters to courses with PTE populated", () => {
    const where = buildAdminCourseWhere({ englishTest: "pte" });
    expect(where.AND).toContainEqual({ pteRequirement: { not: null } });
  });

  it("englishTest=any matches courses with ANY English-test requirement", () => {
    const where = buildAdminCourseWhere({ englishTest: "any" });
    expect(where.AND).toContainEqual({
      OR: [
        { ieltsRequirement: { not: null } },
        { toeflRequirement: { not: null } },
        { pteRequirement: { not: null } },
      ],
    });
  });

  it("filters by intake membership", () => {
    const where = buildAdminCourseWhere({ intakeId: "intake-1" });
    expect(where.AND).toContainEqual({
      intakes: { some: { id: "intake-1" } },
    });
  });

  it("combines all filters into a single AND chain", () => {
    const where = buildAdminCourseWhere({
      archived: false,
      status: "ACTIVE",
      countryId: "c1",
      universityId: "u1",
      degreeLevel: "MASTER",
      tuitionMin: 10000,
      tuitionMax: 50000,
      englishTest: "ielts",
      intakeId: "i1",
      search: "CS",
    });
    // 1 (deletedAt) + 1 (status) + 1 (degreeLevel) + 1 (universityId) +
    // 1 (countryId) + 1 (search) + 1 (tuitionFee) + 1 (ielts) + 1 (intake)
    expect(where.AND).toHaveLength(9);
  });
});

describe("buildAdminIntakeWhere", () => {
  it("filters by deletedAt null when archived=false (default)", () => {
    const where = buildAdminIntakeWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("filters by deletedAt not-null when archived=true", () => {
    const where = buildAdminIntakeWhere({ archived: true });
    expect(where.AND).toContainEqual({ deletedAt: { not: null } });
  });

  it("applies status filter", () => {
    const where = buildAdminIntakeWhere({ status: "ACTIVE" });
    expect(where.AND).toContainEqual({ status: "ACTIVE" });
  });

  it("applies courseId filter", () => {
    const where = buildAdminIntakeWhere({ courseId: "course-1" });
    expect(where.AND).toContainEqual({ courseId: "course-1" });
  });

  it("applies universityId filter via nested course join", () => {
    const where = buildAdminIntakeWhere({ universityId: "u1" });
    expect(where.AND).toContainEqual({ course: { universityId: "u1" } });
  });

  it("applies countryId filter via nested course.university join", () => {
    const where = buildAdminIntakeWhere({ countryId: "c1" });
    expect(where.AND).toContainEqual({
      course: { university: { countryId: "c1" } },
    });
  });

  it("searches across intake name, course name, and university name", () => {
    const where = buildAdminIntakeWhere({ search: "September" });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "September", mode: "insensitive" } },
        { course: { name: { contains: "September", mode: "insensitive" } } },
        {
          course: {
            university: { name: { contains: "September", mode: "insensitive" } },
          },
        },
      ],
    });
  });
});

describe("courseArchiveBlockReason", () => {
  it("allows archiving when no active applications exist", () => {
    expect(courseArchiveBlockReason({ _count: { applications: 0 } })).toBeNull();
    expect(courseArchiveBlockReason({})).toBeNull();
  });

  it("blocks archiving when active applications reference the course", () => {
    const reason = courseArchiveBlockReason({ _count: { applications: 3 } });
    expect(reason).toMatch(/3 active application/);
    expect(reason).toMatch(/deactivate/i);
  });

  it("blocks when already archived (priority over applications)", () => {
    expect(courseArchiveBlockReason({ deletedAt: new Date() })).toMatch(/already archived/i);
    expect(
      courseArchiveBlockReason({ deletedAt: new Date(), _count: { applications: 5 } }),
    ).toMatch(/already archived/i);
  });
});

describe("intakeArchiveBlockReason", () => {
  it("allows archiving when no applications reference the intake", () => {
    expect(intakeArchiveBlockReason({ _count: { applications: 0 } })).toBeNull();
    expect(intakeArchiveBlockReason({})).toBeNull();
  });

  it("blocks archiving when applications reference the intake", () => {
    const reason = intakeArchiveBlockReason({ _count: { applications: 2 } });
    expect(reason).toMatch(/2 application/);
    expect(reason).toMatch(/deactivate/i);
  });

  it("blocks when already archived", () => {
    expect(intakeArchiveBlockReason({ deletedAt: new Date() })).toMatch(/already archived/i);
  });
});

describe("formatTuition", () => {
  it("returns em-dash for nullish input", () => {
    expect(formatTuition(null)).toBe("—");
    expect(formatTuition(undefined)).toBe("—");
  });

  it("formats USD with no decimals", () => {
    expect(formatTuition(32500, "USD")).toMatch(/32,500/);
    expect(formatTuition(32500, "USD")).not.toMatch(/\.\d+/);
  });

  it("defaults currency to USD when not provided", () => {
    expect(formatTuition(5000)).toMatch(/5,000/);
  });

  it("falls back to a plain number for invalid currency codes", () => {
    const out = formatTuition(32500, "NOTACURRENCY");
    expect(out).toContain("32,500");
  });
});

describe("intakeStartLabel", () => {
  it("derives a human-readable start label from month + year", () => {
    expect(intakeStartLabel(9, 2026)).toMatch(/Sep\w* 2026/);
    expect(intakeStartLabel(1, 2027)).toMatch(/Jan\w* 2027/);
  });

  it("returns em-dash for missing month or year", () => {
    expect(intakeStartLabel(null, 2026)).toBe("—");
    expect(intakeStartLabel(9, null)).toBe("—");
    expect(intakeStartLabel(null, null)).toBe("—");
  });

  it("returns em-dash for out-of-range month", () => {
    expect(intakeStartLabel(0, 2026)).toBe("—");
    expect(intakeStartLabel(13, 2026)).toBe("—");
  });
});

describe("courseSchema", () => {
  it("requires universityId, name, and degreeLevel", () => {
    expect(courseSchema.safeParse({}).success).toBe(false);
    expect(
      courseSchema.safeParse({ universityId: "u1", name: "X" }).success,
    ).toBe(false);
    expect(
      courseSchema.safeParse({
        universityId: "u1",
        name: "X",
        degreeLevel: "MASTER",
      }).success,
    ).toBe(true);
  });

  it("accepts the new OTHER degree level", () => {
    expect(
      courseSchema.safeParse({
        universityId: "u1",
        name: "X",
        degreeLevel: "OTHER",
      }).success,
    ).toBe(true);
  });

  it("rejects the old FOUNDATION degree level", () => {
    expect(
      courseSchema.safeParse({
        universityId: "u1",
        name: "X",
        degreeLevel: "FOUNDATION",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown degree levels", () => {
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
      degreeLevel: "BACHELOR",
    });
    expect(out.status).toBe("ACTIVE");
  });

  it("accepts all the specified course fields", () => {
    const out = courseSchema.safeParse({
      universityId: "u1",
      name: "MSc Computer Science",
      degreeLevel: "MASTER",
      duration: "18 months",
      tuitionFee: 32000,
      currency: "USD",
      applicationFee: 125,
      ieltsRequirement: "6.5 overall",
      toeflRequirement: "90 iBT",
      pteRequirement: "62 overall",
      academicRequirements: "Bachelor's degree in CS or related",
      applicationDeadline: "2026-06-30",
      status: "ACTIVE",
    });
    expect(out.success).toBe(true);
  });

  it("rejects negative tuition fees", () => {
    expect(
      courseSchema.safeParse({
        universityId: "u1",
        name: "X",
        degreeLevel: "MASTER",
        tuitionFee: -100,
      }).success,
    ).toBe(false);
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
});

describe("courseUpdateSchema", () => {
  it("is partial — accepts an empty object", () => {
    expect(courseUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts the archived boolean flag", () => {
    expect(courseUpdateSchema.safeParse({ archived: true }).success).toBe(true);
    expect(courseUpdateSchema.safeParse({ archived: false }).success).toBe(true);
  });

  it("still validates fields when supplied", () => {
    expect(
      courseUpdateSchema.safeParse({ tuitionFee: -100 }).success,
    ).toBe(false);
    expect(
      courseUpdateSchema.safeParse({ tuitionFee: 5000 }).success,
    ).toBe(true);
  });

  it("accepts partial updates with multiple fields", () => {
    expect(
      courseUpdateSchema.safeParse({
        name: "Updated Name",
        status: "INACTIVE",
        tuitionFee: 40000,
      }).success,
    ).toBe(true);
  });
});

describe("intakeSchema", () => {
  it("requires courseId and name", () => {
    expect(intakeSchema.safeParse({}).success).toBe(false);
    expect(intakeSchema.safeParse({ courseId: "c1" }).success).toBe(false);
    expect(
      intakeSchema.safeParse({ courseId: "c1", name: "September 2027" }).success,
    ).toBe(false); // month + year are required
  });

  it("requires month and year", () => {
    expect(
      intakeSchema.safeParse({
        courseId: "c1",
        name: "September 2027",
        month: 9,
        year: 2027,
      }).success,
    ).toBe(true);
  });

  it("rejects months outside 1-12", () => {
    expect(
      intakeSchema.safeParse({
        courseId: "c1",
        name: "X",
        month: 0,
        year: 2027,
      }).success,
    ).toBe(false);
    expect(
      intakeSchema.safeParse({
        courseId: "c1",
        name: "X",
        month: 13,
        year: 2027,
      }).success,
    ).toBe(false);
  });

  it("rejects years outside 2024-2100", () => {
    expect(
      intakeSchema.safeParse({
        courseId: "c1",
        name: "X",
        month: 9,
        year: 2020,
      }).success,
    ).toBe(false);
    expect(
      intakeSchema.safeParse({
        courseId: "c1",
        name: "X",
        month: 9,
        year: 2101,
      }).success,
    ).toBe(false);
  });

  it("defaults status to ACTIVE", () => {
    const out = intakeSchema.parse({
      courseId: "c1",
      name: "X",
      month: 9,
      year: 2027,
    });
    expect(out.status).toBe("ACTIVE");
  });

  it("accepts a deadline as an ISO date string", () => {
    expect(
      intakeSchema.safeParse({
        courseId: "c1",
        name: "X",
        month: 9,
        year: 2027,
        deadline: "2027-06-30",
      }).success,
    ).toBe(true);
  });
});

describe("intakeUpdateSchema", () => {
  it("is partial — accepts an empty object", () => {
    expect(intakeUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts the archived boolean flag", () => {
    expect(intakeUpdateSchema.safeParse({ archived: true }).success).toBe(true);
    expect(intakeUpdateSchema.safeParse({ archived: false }).success).toBe(true);
  });

  it("still validates fields when supplied", () => {
    expect(
      intakeUpdateSchema.safeParse({ month: 0 }).success,
    ).toBe(false);
    expect(
      intakeUpdateSchema.safeParse({ month: 6 }).success,
    ).toBe(true);
  });

  it("accepts partial updates with multiple fields", () => {
    expect(
      intakeUpdateSchema.safeParse({
        name: "Updated Intake",
        status: "INACTIVE",
        month: 1,
        year: 2028,
      }).success,
    ).toBe(true);
  });
});
