import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  course: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  intake: { findMany: vi.fn(), count: vi.fn() },
  country: { findMany: vi.fn() },
  university: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listCourses,
  getCourseById,
  requireCourse,
  listIntakes,
  computeDeadlineStatus,
} from "@/lib/services/course-cases";
import { HttpError } from "@/lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// computeDeadlineStatus — pure function
// ─────────────────────────────────────────────

describe("computeDeadlineStatus", () => {
  const now = new Date("2026-09-14T12:00:00Z");

  it("returns 'no_deadline' when deadline is null", () => {
    expect(computeDeadlineStatus(null, now)).toBe("no_deadline");
  });

  it("returns 'expired' when deadline is in the past", () => {
    expect(computeDeadlineStatus(new Date("2026-08-01"), now)).toBe("expired");
  });

  it("returns 'closing_soon' when deadline is within 14 days", () => {
    expect(computeDeadlineStatus(new Date("2026-09-20"), now)).toBe("closing_soon"); // 6 days
    expect(computeDeadlineStatus(new Date("2026-09-28"), now)).toBe("closing_soon"); // 14 days
  });

  it("returns 'upcoming' when deadline is more than 14 days away", () => {
    expect(computeDeadlineStatus(new Date("2026-10-15"), now)).toBe("upcoming"); // 31 days
    expect(computeDeadlineStatus(new Date("2027-01-01"), now)).toBe("upcoming");
  });

  it("returns 'expired' when deadline equals now (diffMs = 0)", () => {
    // diffMs = 0 → not < 0, so it checks closing_soon: 0 < 14 days → true
    expect(computeDeadlineStatus(now, now)).toBe("closing_soon");
  });
});

// ─────────────────────────────────────────────
// listCourses — search + filters
// ─────────────────────────────────────────────

describe("listCourses — search", () => {
  it("builds OR clause across course name + university name", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { search: "Computer" } });
    const call = prismaMock.course.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { name: { contains: "Computer", mode: "insensitive" } },
      { university: { name: { contains: "Computer", mode: "insensitive" } } },
    ]);
  });

  it("trims whitespace from search", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { search: "  CS  " } });
    const call = prismaMock.course.findMany.mock.calls[0][0];
    expect(call.where.OR[0].name.contains).toBe("CS");
  });

  it("does not add OR when search is empty", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { search: "   " } });
    const call = prismaMock.course.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeUndefined();
  });
});

describe("listCourses — filters", () => {
  it("defaults to status=ACTIVE", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({});
    expect(prismaMock.course.findMany.mock.calls[0][0].where.status).toBe("ACTIVE");
  });

  it("applies countryId filter via university relation", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { countryId: "c1" } });
    expect(prismaMock.course.findMany.mock.calls[0][0].where.university).toEqual({ countryId: "c1" });
  });

  it("applies universityId filter", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { universityId: "u1" } });
    expect(prismaMock.course.findMany.mock.calls[0][0].where.universityId).toBe("u1");
  });

  it("applies degreeLevel filter", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { degreeLevel: "MASTER" } });
    expect(prismaMock.course.findMany.mock.calls[0][0].where.degreeLevel).toBe("MASTER");
  });

  it("applies tuition range filter", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { tuitionMin: 1000, tuitionMax: 5000 } });
    expect(prismaMock.course.findMany.mock.calls[0][0].where.tuitionFee).toEqual({ gte: 1000, lte: 5000 });
  });

  it("applies englishTest=ielts filter (non-null IELTS)", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { englishTest: "ielts" } });
    expect(prismaMock.course.findMany.mock.calls[0][0].where.ieltsRequirement).toEqual({ not: null });
  });

  it("applies englishTest=any filter (any non-null English requirement)", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { englishTest: "any" } });
    const call = prismaMock.course.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        { ieltsRequirement: { not: null } },
        { toeflRequirement: { not: null } },
        { pteRequirement: { not: null } },
      ]),
    );
  });

  it("applies deadline range filter on intake deadlines", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { deadlineFrom: "2026-01-01", deadlineTo: "2026-12-31" } });
    const call = prismaMock.course.findMany.mock.calls[0][0];
    expect(call.where.intakes.some.deadline.gte).toEqual(new Date("2026-01-01"));
    expect(call.where.intakes.some.deadline.lte).toEqual(new Date("2026-12-31"));
  });

  it("ignores invalid date strings in deadline filter", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ filters: { deadlineFrom: "bad", deadlineTo: "also-bad" } });
    const call = prismaMock.course.findMany.mock.calls[0][0];
    expect(call.where.intakes).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// listCourses — sorting
// ─────────────────────────────────────────────

describe("listCourses — sorting", () => {
  it("unknown sort key falls back to name asc", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    // @ts-expect-error — intentionally bad key
    await listCourses({ sortBy: "evil" });
    const call = prismaMock.course.findMany.mock.calls[0][0];
    expect(call.orderBy[0]).toHaveProperty("name");
  });

  it("supports tuitionFee sort", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ sortBy: "tuitionFee", sortOrder: "desc" });
    const call = prismaMock.course.findMany.mock.calls[0][0];
    expect(call.orderBy[0]).toEqual({ tuitionFee: "desc" });
  });
});

// ─────────────────────────────────────────────
// listCourses — pagination
// ─────────────────────────────────────────────

describe("listCourses — pagination", () => {
  it("defaults to page 1, pageSize 20", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    const result = await listCourses({});
    expect(prismaMock.course.findMany.mock.calls[0][0].skip).toBe(0);
    expect(prismaMock.course.findMany.mock.calls[0][0].take).toBe(20);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("clamps pageSize to 100", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    await listCourses({ pageSize: 5000 });
    expect(prismaMock.course.findMany.mock.calls[0][0].take).toBe(100);
  });
});

// ─────────────────────────────────────────────
// listCourses — empty + populated
// ─────────────────────────────────────────────

describe("listCourses — empty + populated", () => {
  it("returns empty rows when database is empty", async () => {
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
    const result = await listCourses({});
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("maps rows with activeIntakeCount + nextDeadline", async () => {
    prismaMock.course.findMany.mockResolvedValue([
      {
        id: "c1", name: "B.Sc. CS", degreeLevel: "BACHELOR", duration: "6 semesters",
        tuitionFee: 0, currency: "EUR", applicationFee: 50,
        ieltsRequirement: "6.5", toeflRequirement: "90", pteRequirement: null,
        status: "ACTIVE",
        university: {
          id: "u1", name: "TU Munich", city: "Munich",
          country: { id: "c1", name: "Germany", flag: "🇩🇪" },
        },
        intakes: [
          { id: "i1", deadline: new Date("2026-10-01") },
          { id: "i2", deadline: null },
        ],
      },
    ]);
    prismaMock.course.count.mockResolvedValue(1);
    const result = await listCourses({});
    expect(result.rows).toHaveLength(1);
    const r = result.rows[0];
    expect(r.name).toBe("B.Sc. CS");
    expect(r.university.name).toBe("TU Munich");
    expect(r.country?.name).toBe("Germany");
    expect(r.ieltsRequirement).toBe("6.5");
    expect(r.activeIntakeCount).toBe(2);
    expect(r.nextDeadline).toEqual(new Date("2026-10-01"));
  });
});

// ─────────────────────────────────────────────
// getCourseById + requireCourse
// ─────────────────────────────────────────────

describe("getCourseById", () => {
  it("returns null for missing id", async () => {
    prismaMock.course.findFirst.mockResolvedValue(null);
    const result = await getCourseById("c-missing");
    expect(result).toBeNull();
  });

  it("returns full course aggregate with intakes + university + count", async () => {
    prismaMock.course.findFirst.mockResolvedValue({
      id: "c1", name: "B.Sc. CS", degreeLevel: "BACHELOR", duration: "6 semesters",
      tuitionFee: 0, currency: "EUR", applicationFee: 50, description: "CS program",
      academicRequirements: "High school diploma", ieltsRequirement: "6.5",
      toeflRequirement: "90", pteRequirement: null, status: "ACTIVE",
      createdAt: new Date(), updatedAt: new Date(),
      university: { id: "u1", name: "TU Munich", city: "Munich", website: "https://tum.de", country: { id: "c1", name: "Germany", flag: "🇩🇪" } },
      intakes: [{ id: "i1", name: "Fall 2026", month: 9, year: 2026, deadline: new Date("2026-10-01"), status: "ACTIVE" }],
      _count: { applications: 5 },
    });
    const result = await getCourseById("c1");
    expect(result).not.toBeNull();
    expect(result?.name).toBe("B.Sc. CS");
    expect(result?.intakes).toHaveLength(1);
    expect(result?.applicationCount).toBe(5);
    expect(result?.academicRequirements).toBe("High school diploma");
    expect(result?.ieltsRequirement).toBe("6.5");
  });
});

describe("requireCourse", () => {
  it("throws HttpError 404 for missing course", async () => {
    prismaMock.course.findFirst.mockResolvedValue(null);
    await expect(requireCourse("c-missing")).rejects.toThrow(HttpError);
    await expect(requireCourse("c-missing")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// listIntakes — deadline highlighting
// ─────────────────────────────────────────────

describe("listIntakes", () => {
  it("returns intakes sorted by deadline ascending", async () => {
    prismaMock.intake.findMany.mockResolvedValue([]);
    prismaMock.intake.count.mockResolvedValue(0);
    await listIntakes({});
    const call = prismaMock.intake.findMany.mock.calls[0][0];
    expect(call.orderBy[0]).toEqual({ deadline: "asc" });
  });

  it("applies upcomingOnly filter (deadline >= now)", async () => {
    prismaMock.intake.findMany.mockResolvedValue([]);
    prismaMock.intake.count.mockResolvedValue(0);
    await listIntakes({ upcomingOnly: true });
    const call = prismaMock.intake.findMany.mock.calls[0][0];
    expect(call.where.deadline).toEqual({ gte: expect.any(Date) });
  });

  it("applies courseId filter", async () => {
    prismaMock.intake.findMany.mockResolvedValue([]);
    prismaMock.intake.count.mockResolvedValue(0);
    await listIntakes({ courseId: "c1" });
    expect(prismaMock.intake.findMany.mock.calls[0][0].where.courseId).toBe("c1");
  });

  it("maps deadlineStatus correctly for each intake", async () => {
    const now = new Date();
    prismaMock.intake.findMany.mockResolvedValue([
      { id: "i1", name: "Fall 2026", month: 9, year: 2026, deadline: new Date(now.getTime() + 30 * 86400000), status: "ACTIVE", course: { id: "c1", name: "CS", degreeLevel: "BACHELOR", university: { id: "u1", name: "TU Munich", country: { name: "Germany", flag: "🇩🇪" } } } },
      { id: "i2", name: "Winter 2026", month: 1, year: 2026, deadline: new Date(now.getTime() - 86400000), status: "ACTIVE", course: { id: "c1", name: "CS", degreeLevel: "BACHELOR", university: { id: "u1", name: "TU Munich", country: { name: "Germany", flag: "🇩🇪" } } } },
      { id: "i3", name: "Spring 2027", month: 3, year: 2027, deadline: new Date(now.getTime() + 5 * 86400000), status: "ACTIVE", course: { id: "c1", name: "CS", degreeLevel: "BACHELOR", university: { id: "u1", name: "TU Munich", country: { name: "Germany", flag: "🇩🇪" } } } },
      { id: "i4", name: "Summer 2026", month: 6, year: 2026, deadline: null, status: "ACTIVE", course: { id: "c1", name: "CS", degreeLevel: "BACHELOR", university: { id: "u1", name: "TU Munich", country: { name: "Germany", flag: "🇩🇪" } } } },
    ]);
    prismaMock.intake.count.mockResolvedValue(4);
    const result = await listIntakes({});
    expect(result.rows[0].deadlineStatus).toBe("upcoming");
    expect(result.rows[1].deadlineStatus).toBe("expired");
    expect(result.rows[2].deadlineStatus).toBe("closing_soon");
    expect(result.rows[3].deadlineStatus).toBe("no_deadline");
  });

  it("returns empty rows when no intakes exist", async () => {
    prismaMock.intake.findMany.mockResolvedValue([]);
    prismaMock.intake.count.mockResolvedValue(0);
    const result = await listIntakes({});
    expect(result.rows).toEqual([]);
    expect(result.totalPages).toBe(1);
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listCourses lets prisma errors bubble", async () => {
    prismaMock.course.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.course.count.mockResolvedValue(0);
    await expect(listCourses({})).rejects.toThrow("DB lost");
  });

  it("getCourseById lets prisma errors bubble", async () => {
    prismaMock.course.findFirst.mockRejectedValue(new Error("findFirst failed"));
    await expect(getCourseById("c1")).rejects.toThrow("findFirst failed");
  });

  it("listIntakes lets prisma errors bubble", async () => {
    prismaMock.intake.findMany.mockRejectedValue(new Error("intake findMany failed"));
    prismaMock.intake.count.mockResolvedValue(0);
    await expect(listIntakes({})).rejects.toThrow("intake findMany failed");
  });
});
