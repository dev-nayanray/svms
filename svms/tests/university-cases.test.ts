import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  university: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  country: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listUniversities,
  getUniversityById,
  requireUniversity,
} from "@/lib/services/university-cases";
import { HttpError } from "@/lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// List — search
// ─────────────────────────────────────────────

describe("listUniversities — search", () => {
  it("builds OR clause across name, slug, city, country name, country code", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({ filters: { search: "Munich" } });
    const call = prismaMock.university.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { name: { contains: "Munich", mode: "insensitive" } },
      { slug: { contains: "Munich", mode: "insensitive" } },
      { city: { contains: "Munich", mode: "insensitive" } },
      { country: { name: { contains: "Munich", mode: "insensitive" } } },
      { country: { code: { contains: "MUNICH", mode: "insensitive" } } },
    ]);
  });

  it("trims whitespace from search", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({ filters: { search: "  Berlin  " } });
    const call = prismaMock.university.findMany.mock.calls[0][0];
    expect(call.where.OR[0].name.contains).toBe("Berlin");
  });

  it("does not add OR when search is empty", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({ filters: { search: "   " } });
    const call = prismaMock.university.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// List — filters
// ─────────────────────────────────────────────

describe("listUniversities — filters", () => {
  it("defaults to status=ACTIVE (only published universities)", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({});
    const call = prismaMock.university.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("ACTIVE");
  });

  it("applies countryId filter", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({ filters: { countryId: "c-1" } });
    const call = prismaMock.university.findMany.mock.calls[0][0];
    expect(call.where.countryId).toBe("c-1");
  });

  it("applies rankingMax filter (ranking ≤ N)", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({ filters: { rankingMax: 100 } });
    const call = prismaMock.university.findMany.mock.calls[0][0];
    expect(call.where.ranking).toEqual({ lte: 100 });
  });

  it("applies status filter when explicitly provided", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({ filters: { status: "INACTIVE" } });
    const call = prismaMock.university.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("INACTIVE");
  });

  it("intakeAvailable filter — only universities with active intakes returned", async () => {
    prismaMock.university.findMany.mockResolvedValue([
      {
        id: "u1", name: "Uni A", slug: "uni-a", city: null, website: null, description: null, ranking: null, status: "ACTIVE",
        country: { id: "c1", name: "Germany", flag: "🇩🇪" },
        courses: [{ id: "co1", intakes: [{ id: "i1" }] }], // 1 active intake
      },
      {
        id: "u2", name: "Uni B", slug: "uni-b", city: null, website: null, description: null, ranking: null, status: "ACTIVE",
        country: { id: "c1", name: "Germany", flag: "🇩🇪" },
        courses: [{ id: "co2", intakes: [] }], // 0 active intakes
      },
    ]);
    prismaMock.university.count.mockResolvedValue(2);
    const result = await listUniversities({ filters: { intakeAvailable: true } });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Uni A");
    expect(result.rows[0].activeIntakeCount).toBe(1);
  });
});

// ─────────────────────────────────────────────
// List — pagination
// ─────────────────────────────────────────────

describe("listUniversities — pagination", () => {
  it("defaults to page 1, pageSize 20", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    const result = await listUniversities({});
    expect(prismaMock.university.findMany.mock.calls[0][0].skip).toBe(0);
    expect(prismaMock.university.findMany.mock.calls[0][0].take).toBe(20);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("computes skip for page 3 with pageSize 10", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(25);
    const result = await listUniversities({ page: 3, pageSize: 10 });
    expect(prismaMock.university.findMany.mock.calls[0][0].skip).toBe(20);
    expect(result.totalPages).toBe(3);
  });

  it("clamps pageSize to 100", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({ pageSize: 5000 });
    expect(prismaMock.university.findMany.mock.calls[0][0].take).toBe(100);
  });

  it("clamps pageSize to 1", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    await listUniversities({ pageSize: 0 });
    expect(prismaMock.university.findMany.mock.calls[0][0].take).toBe(1);
  });
});

// ─────────────────────────────────────────────
// List — empty + populated
// ─────────────────────────────────────────────

describe("listUniversities — empty + populated", () => {
  it("returns empty rows + totalPages=1 when database is empty", async () => {
    prismaMock.university.findMany.mockResolvedValue([]);
    prismaMock.university.count.mockResolvedValue(0);
    const result = await listUniversities({});
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("maps rows with courseCount + activeIntakeCount", async () => {
    prismaMock.university.findMany.mockResolvedValue([
      {
        id: "u1", name: "TU Munich", slug: "tu-munich", city: "Munich", website: "https://tum.de",
        description: "Top tech uni", ranking: 1, status: "ACTIVE",
        country: { id: "c1", name: "Germany", flag: "🇩🇪" },
        courses: [
          { id: "co1", intakes: [{ id: "i1" }, { id: "i2" }] },
          { id: "co2", intakes: [{ id: "i3" }] },
        ],
      },
    ]);
    prismaMock.university.count.mockResolvedValue(1);
    const result = await listUniversities({});
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("TU Munich");
    expect(result.rows[0].courseCount).toBe(2);
    expect(result.rows[0].activeIntakeCount).toBe(3);
    expect(result.rows[0].country?.name).toBe("Germany");
  });
});

// ─────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────

describe("getUniversityById", () => {
  it("returns null for a missing id", async () => {
    prismaMock.university.findFirst.mockResolvedValue(null);
    const result = await getUniversityById("uni-missing");
    expect(result).toBeNull();
  });

  it("returns the full university aggregate with courses + intakes + applications", async () => {
    const fixture = {
      id: "u1", name: "TU Munich", slug: "tu-munich", city: "Munich", website: "https://tum.de",
      description: "Top tech uni", ranking: 1, status: "ACTIVE",
      createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-08-01"),
      country: { id: "c1", name: "Germany", flag: "🇩🇪", currency: "EUR" },
      courses: [
        {
          id: "co1", name: "B.Sc. CS", degreeLevel: "BACHELOR", duration: "6 semesters",
          tuitionFee: 0, currency: "EUR", description: "CS program", status: "ACTIVE",
          intakes: [{ id: "i1", name: "Fall 2026", month: 9, year: 2026, deadline: null, status: "ACTIVE" }],
          _count: { applications: 3 },
        },
      ],
      applications: [
        { id: "a1", applicationNumber: "APP-001", stageKey: "VISA_SUBMITTED", status: "NEW",
          student: { id: "s1", firstName: "Karim", lastName: "Ahmed", studentId: "STD-1" } },
      ],
    };
    prismaMock.university.findFirst.mockResolvedValue(fixture);
    const result = await getUniversityById("u1");
    expect(result).not.toBeNull();
    expect(result?.name).toBe("TU Munich");
    expect(result?.courses).toHaveLength(1);
    expect(result?.courses[0].intakes).toHaveLength(1);
    expect(result?.courses[0]._count.applications).toBe(3);
    expect(result?.applications).toHaveLength(1);
    expect(result?.applications[0].student.firstName).toBe("Karim");
  });
});

describe("requireUniversity", () => {
  it("throws HttpError 404 for missing university", async () => {
    prismaMock.university.findFirst.mockResolvedValue(null);
    await expect(requireUniversity("uni-missing")).rejects.toThrow(HttpError);
    await expect(requireUniversity("uni-missing")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listUniversities lets prisma errors bubble", async () => {
    prismaMock.university.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.university.count.mockResolvedValue(0);
    await expect(listUniversities({})).rejects.toThrow("DB lost");
  });

  it("getUniversityById lets prisma errors bubble", async () => {
    prismaMock.university.findFirst.mockRejectedValue(new Error("findFirst failed"));
    await expect(getUniversityById("u1")).rejects.toThrow("findFirst failed");
  });
});
