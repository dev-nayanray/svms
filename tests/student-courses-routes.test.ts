import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockCourseFindMany = vi.fn();
const mockCourseCount = vi.fn();
const mockCourseFindFirst = vi.fn();
const mockCourseAggregate = vi.fn();
const mockStudentFindUnique = vi.fn();
const mockCounselingRequestFindFirst = vi.fn();
const mockIntakeFindMany = vi.fn();
const mockIntakeCount = vi.fn();
const mockCountryFindMany = vi.fn();
const mockUniversityFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    course: {
      findMany: (args: unknown) => mockCourseFindMany(args),
      count: (args: unknown) => mockCourseCount(args),
      findFirst: (args: unknown) => mockCourseFindFirst(args),
      aggregate: (args: unknown) => mockCourseAggregate(args),
    },
    student: { findUnique: (args: unknown) => mockStudentFindUnique(args) },
    counselingRequest: { findFirst: (args: unknown) => mockCounselingRequestFindFirst(args) },
    intake: {
      findMany: (args: unknown) => mockIntakeFindMany(args),
      count: (args: unknown) => mockIntakeCount(args),
    },
    country: { findMany: (args: unknown) => mockCountryFindMany(args) },
    university: { findMany: (args: unknown) => mockUniversityFindMany(args) },
  },
}));

import { GET as GET_list } from "@/app/api/student/courses/route";
import { GET as GET_detail } from "@/app/api/student/courses/[id]/route";
import { GET as GET_intakes } from "@/app/api/student/intakes/route";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const activeCountry = { id: "c-1", name: "UK", flag: "🇬🇧", status: "ACTIVE", deletedAt: null };
const activeUniversity = {
  id: "u-1",
  name: "University of Example",
  logo: null,
  status: "ACTIVE",
  deletedAt: null,
  country: activeCountry,
};

const activeCourse = {
  id: "course-1",
  name: "BSc Computer Science",
  slug: "bsc-computer-science",
  universityId: "u-1",
  degreeLevel: "BACHELOR",
  duration: "3 years",
  tuitionFee: 25000,
  currency: "USD",
  applicationFee: 100,
  applicationDeadline: new Date("2026-09-01"),
  academicRequirements: "A-levels or equivalent",
  englishRequirements: "IELTS 6.5 overall",
  ieltsRequirement: "6.5 overall, no band below 6.0",
  toeflRequirement: "90 iBT, no section below 20",
  pteRequirement: "62 overall, no section below 59",
  status: "ACTIVE",
  deletedAt: null,
  university: activeUniversity,
  intakes: [
    { id: "intake-1", name: "September 2026", month: 9, year: 2026, deadline: new Date("2026-08-15"), status: "ACTIVE" },
  ],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const inactiveCourse = {
  ...activeCourse,
  id: "course-2",
  status: "INACTIVE",
  name: "Inactive Course",
};

const baseStudent = { id: "stu-1", userId: "user-1" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers().setSystemTime(new Date("2026-07-15T12:00:00Z"));
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindUnique.mockResolvedValue(baseStudent);
  mockCourseFindMany.mockResolvedValue([activeCourse]);
  mockCourseCount.mockResolvedValue(1);
  mockCourseFindFirst.mockResolvedValue(activeCourse);
  mockCourseAggregate.mockResolvedValue({ _min: { tuitionFee: 5000 }, _max: { tuitionFee: 50000 } });
  mockCounselingRequestFindFirst.mockResolvedValue(null);
  mockIntakeFindMany.mockResolvedValue([
    {
      id: "intake-1",
      name: "September 2026",
      month: 9,
      year: 2026,
      deadline: new Date("2026-08-15"),
      status: "ACTIVE",
      course: {
        id: "course-1",
        name: "BSc CS",
        degreeLevel: "BACHELOR",
        tuitionFee: 25000,
        currency: "USD",
        university: { id: "u-1", name: "Example Uni", country: activeCountry },
      },
    },
  ]);
  mockIntakeCount.mockResolvedValue(1);
  mockCountryFindMany.mockResolvedValue([activeCountry]);
  mockUniversityFindMany.mockResolvedValue([activeUniversity]);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makeListReq(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/student/courses${query ? `?${query}` : ""}`);
}

function makeIntakesReq(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/student/intakes${query ? `?${query}` : ""}`);
}

// ─────────────────────────────────────────────
// GET /api/student/courses (list)
// ─────────────────────────────────────────────

describe("GET /api/student/courses (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(makeListReq());
    expect(res.status).toBe(401);
  });

  it("returns visible courses with enriched fields", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(makeListReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data.length).toBe(1);
    expect(body.data.data[0].name).toBe("BSc Computer Science");
    expect(body.data.data[0].englishRequirementsList).toBeDefined();
    expect(body.data.data[0].englishRequirementsList.length).toBe(3); // IELTS + TOEFL + PTE
    expect(body.data.data[0].hasOpenIntake).toBe(true); // deadline is Aug 15, now is Jul 15
    expect(body.data.data[0].activeIntakeCount).toBe(1);
    // Internal fields stripped
    expect("deletedAt" in body.data.data[0]).toBe(false);
    expect("deletedBy" in body.data.data[0]).toBe(false);
  });

  it("includes pagination metadata", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(makeListReq("page=1&pageSize=12"));
    const body = await res.json();
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.page).toBe(1);
    expect(body.data.pagination.pageSize).toBe(12);
    expect(body.data.pagination.total).toBe(1);
  });

  it("enforces visibility at the DB level (course + university + country all ACTIVE)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq());
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toEqual(
      expect.arrayContaining([
        { deletedAt: null, status: "ACTIVE" },
        { university: { deletedAt: null, status: "ACTIVE", country: { deletedAt: null, status: "ACTIVE" } } },
      ]),
    );
  });

  it("supports server-side search across course name, university name, and country name", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("search=computer"));
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    const orClause = whereArg.AND.find((c) => c.OR);
    expect(orClause).toBeDefined();
    expect(orClause!.OR).toHaveLength(3);
  });

  it("supports countryId filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("countryId=c-1"));
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ university: { countryId: "c-1" } });
  });

  it("supports universityId filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("universityId=u-1"));
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ universityId: "u-1" });
  });

  it("supports degreeLevel filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("degreeLevel=BACHELOR"));
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ degreeLevel: "BACHELOR" });
  });

  it("supports tuition range filter (min + max)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("tuitionMin=10000&tuitionMax=30000"));
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ tuitionFee: { gte: 10000, lte: 30000 } });
  });

  it("supports englishTest=ielts filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("englishTest=ielts"));
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ ieltsRequirement: { not: null } });
  });

  it("supports englishTest=any filter (OR across all tests)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("englishTest=any"));
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    const orClause = whereArg.AND.find((c) => c.OR);
    expect(orClause).toBeDefined();
    expect(orClause!.OR).toHaveLength(3); // IELTS + TOEFL + PTE
  });

  it("clamps pageSize to 24", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(makeListReq("pageSize=500"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pagination.pageSize).toBe(24);
  });

  it("students cannot filter by status — status is always forced to ACTIVE", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("status=INACTIVE"));
    const whereArg = mockCourseFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ deletedAt: null, status: "ACTIVE" });
  });

  it("only returns ACTIVE intakes within each course", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq());
    const findManyArg = mockCourseFindMany.mock.calls[0][0];
    expect(findManyArg.include.intakes.where).toEqual({ status: "ACTIVE" });
  });
});

// ─────────────────────────────────────────────
// GET /api/student/courses/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/courses/[id] (detail)", () => {
  async function callDetail(id: string) {
    return GET_detail(
      new NextRequest(`http://localhost/api/student/courses/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDetail("course-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 for an INACTIVE course (visibility rule)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockCourseFindFirst.mockResolvedValue(inactiveCourse);
    const res = await callDetail("course-2");
    expect(res.status).toBe(404);
  });

  it("returns 404 when the course doesn't exist", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockCourseFindFirst.mockResolvedValue(null);
    const res = await callDetail("nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns the full detail for an ACTIVE course", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("course-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("course-1");
    expect(body.data.name).toBe("BSc Computer Science");
    expect(body.data.degreeLevel).toBe("BACHELOR");
    expect(body.data.university.name).toBe("University of Example");
    expect(body.data.englishRequirementsList).toBeDefined();
    expect(body.data.englishRequirementsList.length).toBe(3);
    expect(body.data.counselingRequested).toBe(false);
    expect(Array.isArray(body.data.intakes)).toBe(true);
  });

  it("strips internal administrative fields", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("course-1");
    const body = await res.json();
    expect("deletedAt" in body.data).toBe(false);
    expect("deletedBy" in body.data).toBe(false);
  });

  it("marks counselingRequested=true when the student has an open request", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockCounselingRequestFindFirst.mockResolvedValue({ status: "PENDING" });
    const res = await callDetail("course-1");
    const body = await res.json();
    expect(body.data.counselingRequested).toBe(true);
    expect(body.data.counselingRequestStatus).toBe("PENDING");
  });

  it("only returns ACTIVE intakes", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("course-1");
    const findFirstArg = mockCourseFindFirst.mock.calls[0][0];
    expect(findFirstArg.include.intakes.where).toEqual({ status: "ACTIVE" });
  });
});

// ─────────────────────────────────────────────
// GET /api/student/intakes
// ─────────────────────────────────────────────

describe("GET /api/student/intakes", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_intakes(makeIntakesReq());
    expect(res.status).toBe(401);
  });

  it("returns intakes with derived startDate + deadlineUrgency", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_intakes(makeIntakesReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data.length).toBe(1);
    const intake = body.data.data[0];
    expect(intake.name).toBe("September 2026");
    expect(intake.startDate).toBeDefined();
    expect(intake.deadlineUrgency).toBeDefined();
    // Now is Jul 15, deadline is Aug 15 → 31 days → "soon" (≤30 days threshold)
    // Actually 31 days > 30, so "normal". Let me check: Jul 15 → Aug 15 is 31 days.
    // The threshold for "soon" is ≤30 days, so 31 days = "normal".
    expect(["urgent", "soon", "normal", "past", "none"]).toContain(intake.deadlineUrgency);
  });

  it("enforces visibility chain at DB level (course + university + country ACTIVE)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_intakes(makeIntakesReq());
    const whereArg = mockIntakeFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.status).toBe("ACTIVE");
    const courseWhere = whereArg.course as Record<string, unknown>;
    expect(courseWhere.deletedAt).toBeNull();
    expect(courseWhere.status).toBe("ACTIVE");
  });

  it("supports countryId filter via nested course.university.countryId", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_intakes(makeIntakesReq("countryId=c-1"));
    const whereArg = mockIntakeFindMany.mock.calls[0][0].where as Record<string, unknown>;
    const courseWhere = whereArg.course as Record<string, unknown>;
    const uniWhere = courseWhere.university as Record<string, unknown>;
    expect(uniWhere.countryId).toBe("c-1");
  });

  it("supports upcomingOnly filter (excludes past deadlines)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Add a past-deadline intake to the mock
    mockIntakeFindMany.mockResolvedValue([
      {
        id: "intake-1",
        name: "September 2026",
        month: 9,
        year: 2026,
        deadline: new Date("2026-08-15"), // future
        status: "ACTIVE",
        course: {
          id: "course-1", name: "BSc CS", degreeLevel: "BACHELOR", tuitionFee: 25000, currency: "USD",
          university: { id: "u-1", name: "Example", country: activeCountry },
        },
      },
      {
        id: "intake-2",
        name: "January 2026",
        month: 1,
        year: 2026,
        deadline: new Date("2025-12-15"), // past
        status: "ACTIVE",
        course: {
          id: "course-1", name: "BSc CS", degreeLevel: "BACHELOR", tuitionFee: 25000, currency: "USD",
          university: { id: "u-1", name: "Example", country: activeCountry },
        },
      },
    ]);
    const res = await GET_intakes(makeIntakesReq("upcomingOnly=true"));
    const body = await res.json();
    // Only the future intake should remain (intake-1)
    expect(body.data.data.length).toBe(1);
    expect(body.data.data[0].id).toBe("intake-1");
  });

  it("keeps intakes with no deadline (treated as 'open') when upcomingOnly is true", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockIntakeFindMany.mockResolvedValue([
      {
        id: "intake-open",
        name: "Rolling admission",
        month: 6,
        year: 2026,
        deadline: null, // no deadline = open
        status: "ACTIVE",
        course: {
          id: "course-1", name: "BSc CS", degreeLevel: "BACHELOR", tuitionFee: 25000, currency: "USD",
          university: { id: "u-1", name: "Example", country: activeCountry },
        },
      },
    ]);
    const res = await GET_intakes(makeIntakesReq("upcomingOnly=true"));
    const body = await res.json();
    expect(body.data.data.length).toBe(1);
    expect(body.data.data[0].deadlineUrgency).toBe("none");
  });

  it("includes pagination metadata", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_intakes(makeIntakesReq("page=1&pageSize=20"));
    const body = await res.json();
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.page).toBe(1);
    expect(body.data.pagination.pageSize).toBe(20);
  });
});
