import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockUniversityFindMany = vi.fn();
const mockUniversityCount = vi.fn();
const mockUniversityFindFirst = vi.fn();
const mockStudentFindUnique = vi.fn();
const mockUniversityFavoriteFindUnique = vi.fn();
const mockCounselingRequestFindFirst = vi.fn();
const mockDocumentRequirementFindMany = vi.fn();
const mockVisaRequirementFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    university: {
      findMany: (args: unknown) => mockUniversityFindMany(args),
      count: (args: unknown) => mockUniversityCount(args),
      findFirst: (args: unknown) => mockUniversityFindFirst(args),
      aggregate: vi.fn(),
    },
    student: { findUnique: (args: unknown) => mockStudentFindUnique(args) },
    universityFavorite: {
      findUnique: (args: unknown) => mockUniversityFavoriteFindUnique(args),
    },
    counselingRequest: {
      findFirst: (args: unknown) => mockCounselingRequestFindFirst(args),
    },
    documentRequirement: { findMany: (args: unknown) => mockDocumentRequirementFindMany(args) },
    visaRequirement: { findMany: (args: unknown) => mockVisaRequirementFindMany(args) },
    country: { findMany: vi.fn() },
  },
}));

import { GET as GET_list } from "@/app/api/student/universities/route";
import { GET as GET_detail } from "@/app/api/student/universities/[id]/route";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const baseStudent = { id: "stu-1", userId: "user-1", universityFavorites: [] as { universityId: string }[] };
const activeCountry = { id: "c-1", name: "UK", flag: "🇬🇧", code: "GB", currency: "GBP", status: "ACTIVE", deletedAt: null };

const activeUniversity = {
  id: "u-1",
  name: "University of Example",
  slug: "university-of-example",
  city: "London",
  website: "https://example.ac.uk",
  logo: null,
  description: "A great university.",
  ranking: 50,
  applicationFee: 100,
  status: "ACTIVE",
  deletedAt: null,
  countryId: "c-1",
  country: activeCountry,
  courses: [],
  // The list route destructures `_count` from the Prisma include.
  _count: { courses: 3 },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const inactiveUniversity = {
  ...activeUniversity,
  id: "u-2",
  status: "INACTIVE",
  name: "Inactive University",
};

const deletedUniversity = {
  ...activeUniversity,
  id: "u-3",
  deletedAt: new Date("2026-01-01"),
  name: "Deleted University",
};

beforeEach(() => {
  vi.resetAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindUnique.mockResolvedValue(baseStudent);
  mockUniversityFindMany.mockResolvedValue([activeUniversity]);
  mockUniversityCount.mockResolvedValue(1);
  mockUniversityFindFirst.mockResolvedValue(activeUniversity);
  mockUniversityFavoriteFindUnique.mockResolvedValue(null);
  mockCounselingRequestFindFirst.mockResolvedValue(null);
  mockDocumentRequirementFindMany.mockResolvedValue([]);
  mockVisaRequirementFindMany.mockResolvedValue([]);
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makeListReq(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/student/universities${query ? `?${query}` : ""}`);
}

// ─────────────────────────────────────────────
// GET /api/student/universities (list)
// ─────────────────────────────────────────────

describe("GET /api/student/universities (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(makeListReq());
    expect(res.status).toBe(401);
  });

  it("returns visible universities with isFavorite flag", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(makeListReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.data.length).toBe(1);
    expect(body.data.data[0].name).toBe("University of Example");
    expect(body.data.data[0].isFavorite).toBe(false);
    expect(body.data.data[0].courseCount).toBeDefined();
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
    expect(body.data.pagination.totalPages).toBe(1);
  });

  it("enforces visibility at the DB level (status=ACTIVE, deletedAt=null, country ACTIVE)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq());
    // The where clause must include the visibility predicates.
    const whereArg = mockUniversityFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toEqual(
      expect.arrayContaining([
        { deletedAt: null, status: "ACTIVE" },
        { country: { deletedAt: null, status: "ACTIVE" } },
      ]),
    );
  });

  it("supports server-side search across name, city, and country", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("search=London"));
    const whereArg = mockUniversityFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    // The search is an OR clause across name, city, and country.name.
    const orClause = whereArg.AND.find((c: Record<string, unknown>) => c.OR);
    expect(orClause).toBeDefined();
    expect(orClause!.OR).toHaveLength(3);
  });

  it("supports countryId filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("countryId=c-1"));
    const whereArg = mockUniversityFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ countryId: "c-1" });
  });

  it("supports city filter (case-insensitive contains)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("city=London"));
    const whereArg = mockUniversityFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({
      city: { contains: "London", mode: "insensitive" },
    });
  });

  it("supports rankingMax filter (lte)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("rankingMax=100"));
    const whereArg = mockUniversityFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ ranking: { lte: 100 } });
  });

  it("supports favoriteOnly filter", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockStudentFindUnique.mockResolvedValue({
      ...baseStudent,
      universityFavorites: [{ universityId: "u-1" }],
    });
    await GET_list(makeListReq("favoriteOnly=true"));
    const whereArg = mockUniversityFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ id: { in: ["u-1"] } });
  });

  it("favoriteOnly with no favorites returns an impossible match", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockStudentFindUnique.mockResolvedValue({
      ...baseStudent,
      universityFavorites: [],
    });
    await GET_list(makeListReq("favoriteOnly=true"));
    const whereArg = mockUniversityFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(whereArg.AND).toContainEqual({ id: { in: [] } });
  });

  it("supports sortBy=name (ascending)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("sortBy=name"));
    const orderBy = mockUniversityFindMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual({ name: "asc" });
  });

  it("supports sortBy=ranking (ascending — lower is better)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(makeListReq("sortBy=ranking"));
    const orderBy = mockUniversityFindMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual({ ranking: "asc" });
  });

  it("students cannot filter by status — status is always forced to ACTIVE", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Even if a student tries ?status=INACTIVE, the route ignores it.
    await GET_list(makeListReq("status=INACTIVE"));
    const whereArg = mockUniversityFindMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    // The visibility clause still requires ACTIVE.
    expect(whereArg.AND).toContainEqual({ deletedAt: null, status: "ACTIVE" });
  });

  it("clamps pageSize to 24 (Math.min, not a 422 reject)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // The route does Math.min(Number(pageSize ?? 12), 24) before the
    // schema parse, so pageSize=500 is silently clamped to 24 — it
    // never reaches the schema's .max(100) check. This is intentional:
    // students get a reasonable page size without a 422 for typos.
    const res = await GET_list(makeListReq("pageSize=500"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pagination.pageSize).toBe(24);
  });

  it("marks isFavorite=true when the student has favorited the university", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockStudentFindUnique.mockResolvedValue({
      ...baseStudent,
      universityFavorites: [{ universityId: "u-1" }],
    });
    const res = await GET_list(makeListReq());
    const body = await res.json();
    expect(body.data.data[0].isFavorite).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/student/universities/[id] (detail)
// ─────────────────────────────────────────────

describe("GET /api/student/universities/[id] (detail)", () => {
  async function callDetail(id: string) {
    return GET_detail(
      new NextRequest(`http://localhost/api/student/universities/${id}`),
      { params: Promise.resolve({ id }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callDetail("u-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 for an INACTIVE university (visibility rule)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockUniversityFindFirst.mockResolvedValue(inactiveUniversity);
    const res = await callDetail("u-2");
    expect(res.status).toBe(404);
  });

  it("returns 404 for a soft-deleted university (visibility rule)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockUniversityFindFirst.mockResolvedValue(deletedUniversity);
    const res = await callDetail("u-3");
    expect(res.status).toBe(404);
  });

  it("returns 404 when the university doesn't exist at all", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockUniversityFindFirst.mockResolvedValue(null);
    const res = await callDetail("nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns the full detail for an ACTIVE university in an ACTIVE country", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("u-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("u-1");
    expect(body.data.name).toBe("University of Example");
    expect(body.data.country.name).toBe("UK");
    expect(body.data.isFavorite).toBe(false);
    expect(body.data.counselingRequested).toBe(false);
    expect(Array.isArray(body.data.courses)).toBe(true);
    expect(Array.isArray(body.data.intakes)).toBe(true);
    expect(Array.isArray(body.data.documentRequirements)).toBe(true);
    expect(Array.isArray(body.data.visaRequirements)).toBe(true);
  });

  it("strips internal administrative fields from the response", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callDetail("u-1");
    const body = await res.json();
    expect("deletedAt" in body.data).toBe(false);
    expect("deletedBy" in body.data).toBe(false);
  });

  it("marks isFavorite=true when the student has favorited this university", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockUniversityFavoriteFindUnique.mockResolvedValue({ id: "fav-1" });
    const res = await callDetail("u-1");
    const body = await res.json();
    expect(body.data.isFavorite).toBe(true);
  });

  it("marks counselingRequested=true when the student has an open counseling request", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockCounselingRequestFindFirst.mockResolvedValue({ status: "PENDING" });
    const res = await callDetail("u-1");
    const body = await res.json();
    expect(body.data.counselingRequested).toBe(true);
    expect(body.data.counselingRequestStatus).toBe("PENDING");
  });

  it("only returns ACTIVE courses (deleted/archived courses are excluded)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("u-1");
    const findFirstArg = mockUniversityFindFirst.mock.calls[0][0];
    expect(findFirstArg.include.courses.where).toEqual(
      expect.objectContaining({ deletedAt: null, status: "ACTIVE" }),
    );
  });

  it("only returns ACTIVE intakes within courses", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("u-1");
    const findFirstArg = mockUniversityFindFirst.mock.calls[0][0];
    expect(findFirstArg.include.courses.include.intakes.where).toEqual(
      expect.objectContaining({ status: "ACTIVE" }),
    );
  });

  it("only returns ACTIVE document + visa requirements", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("u-1");
    expect(mockDocumentRequirementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
    expect(mockVisaRequirementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("scopes document requirements to the university's country OR global (countryId=null)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("u-1");
    expect(mockDocumentRequirementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ countryId: "c-1" }, { countryId: null }],
        }),
      }),
    );
  });

  it("scopes visa requirements to the university's country only", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callDetail("u-1");
    expect(mockVisaRequirementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ countryId: "c-1" }),
      }),
    );
  });
});
