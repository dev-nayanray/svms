import { describe, it, expect } from "vitest";
import {
  UNIVERSITY_STATUSES,
  UNIVERSITY_STATUS_LABELS,
  UNIVERSITY_SORT_KEYS,
  normalizeSlug,
  archiveBlockReason,
  buildAdminUniversityWhere,
  formatFee,
  isValidSlug,
} from "@/lib/constants/universities-admin";
import {
  universitySchema,
  universityUpdateSchema,
} from "@/lib/validations";

describe("university admin enums", () => {
  it("exposes exactly ACTIVE and INACTIVE", () => {
    expect(UNIVERSITY_STATUSES).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("labels every status", () => {
    for (const s of UNIVERSITY_STATUSES) {
      expect(typeof UNIVERSITY_STATUS_LABELS[s]).toBe("string");
      expect(UNIVERSITY_STATUS_LABELS[s].length).toBeGreaterThan(0);
    }
    expect(UNIVERSITY_STATUS_LABELS.ACTIVE).toBe("Active");
    expect(UNIVERSITY_STATUS_LABELS.INACTIVE).toBe("Inactive");
  });

  it("exposes a stable sort allow-list", () => {
    expect(UNIVERSITY_SORT_KEYS).toEqual([
      "name",
      "ranking",
      "applicationFee",
      "status",
      "createdAt",
    ]);
  });
});

describe("normalizeSlug", () => {
  it("lowercases and replaces non-alphanumeric runs with dashes", () => {
    expect(normalizeSlug("University of Manchester")).toBe("university-of-manchester");
    expect(normalizeSlug("MIT — CSAIL")).toBe("mit-csail");
    expect(normalizeSlug("St. Mary's College")).toBe("st-marys-college");
  });

  it("trims leading/trailing whitespace and dashes", () => {
    expect(normalizeSlug("  University of Toronto  ")).toBe("university-of-toronto");
    expect(normalizeSlug("---Test---")).toBe("test");
  });

  it("collapses multiple whitespace separators into a single dash", () => {
    expect(normalizeSlug("University   of    Toronto")).toBe("university-of-toronto");
  });

  it("strips underscores (they're not in the slug charset)", () => {
    // Underscores are removed by the `[^a-z0-9\s-]` strip step, so
    // "University_of__Toronto" → "UniversityofToronto" → "universityoftoronto".
    // This is intentional — slugs use dashes only, never underscores.
    expect(normalizeSlug("University_of__Toronto")).toBe("universityoftoronto");
  });

  it("returns empty string for nullish/blank input", () => {
    expect(normalizeSlug(null)).toBe("");
    expect(normalizeSlug(undefined)).toBe("");
    expect(normalizeSlug("")).toBe("");
    expect(normalizeSlug("   ")).toBe("");
  });

  it("preserves digits", () => {
    expect(normalizeSlug("University 365")).toBe("university-365");
    expect(normalizeSlug("Course 101")).toBe("course-101");
  });
});

describe("archiveBlockReason", () => {
  it("allows archiving when no active applications exist", () => {
    expect(archiveBlockReason({ _count: { applications: 0 } })).toBeNull();
    expect(archiveBlockReason({})).toBeNull();
    expect(archiveBlockReason({ _count: {} })).toBeNull();
  });

  it("blocks archiving when active applications reference the university", () => {
    const reason = archiveBlockReason({ _count: { applications: 3 } });
    expect(reason).toMatch(/3 active application/);
    expect(reason).toMatch(/deactivate/i);
  });

  it("blocks when the university is already archived", () => {
    expect(archiveBlockReason({ deletedAt: new Date() })).toMatch(/already archived/i);
    expect(archiveBlockReason({ deletedAt: "2026-01-01" })).toMatch(/already archived/i);
  });

  it("prioritizes the already-archived check over the applications check", () => {
    // Even if there are active applications, an already-archived university
    // surfaces the "already archived" message first.
    expect(
      archiveBlockReason({ deletedAt: new Date(), _count: { applications: 5 } }),
    ).toMatch(/already archived/i);
  });
});

describe("buildAdminUniversityWhere", () => {
  it("filters by deletedAt null when archived=false (default)", () => {
    const where = buildAdminUniversityWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("filters by deletedAt not-null when archived=true", () => {
    const where = buildAdminUniversityWhere({ archived: true });
    expect(where.AND).toContainEqual({ deletedAt: { not: null } });
  });

  it("applies status filter as an AND clause", () => {
    const where = buildAdminUniversityWhere({ status: "ACTIVE" });
    expect(where.AND).toContainEqual({ status: "ACTIVE" });
  });

  it("applies countryId filter as an AND clause", () => {
    const where = buildAdminUniversityWhere({ countryId: "c1" });
    expect(where.AND).toContainEqual({ countryId: "c1" });
  });

  it("searches across name, city, and country name (OR-combined)", () => {
    const where = buildAdminUniversityWhere({ search: "Manchester" });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "Manchester", mode: "insensitive" } },
        { city: { contains: "Manchester", mode: "insensitive" } },
        { country: { name: { contains: "Manchester", mode: "insensitive" } } },
      ],
    });
  });

  it("trims whitespace from search before filtering", () => {
    const where = buildAdminUniversityWhere({ search: "  Toronto  " });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "Toronto", mode: "insensitive" } },
        { city: { contains: "Toronto", mode: "insensitive" } },
        { country: { name: { contains: "Toronto", mode: "insensitive" } } },
      ],
    });
  });

  it("combines archived + status + countryId + search into a single AND chain", () => {
    const where = buildAdminUniversityWhere({
      archived: false,
      status: "ACTIVE",
      countryId: "c1",
      search: "MIT",
    });
    expect(where.AND).toHaveLength(4);
    expect(where.AND).toContainEqual({ deletedAt: null });
    expect(where.AND).toContainEqual({ status: "ACTIVE" });
    expect(where.AND).toContainEqual({ countryId: "c1" });
  });

  it("omits the status clause when status is undefined", () => {
    const where = buildAdminUniversityWhere({});
    const andClauses = where.AND as Record<string, unknown>[];
    const hasStatusClause = andClauses.some((c) => "status" in c);
    expect(hasStatusClause).toBe(false);
  });
});

describe("formatFee", () => {
  it("returns em-dash for nullish input", () => {
    expect(formatFee(null)).toBe("—");
    expect(formatFee(undefined)).toBe("—");
  });

  it("formats USD with no decimals", () => {
    expect(formatFee(125, "USD")).toMatch(/125/);
    expect(formatFee(125, "USD")).not.toMatch(/\.\d+/);
  });

  it("defaults currency to USD when not provided", () => {
    expect(formatFee(100)).toMatch(/100/);
  });

  it("falls back to a plain number for invalid currency codes", () => {
    const out = formatFee(125, "NOTACURRENCY");
    expect(out).toContain("125");
  });

  it("handles large numbers with thousands separators", () => {
    const out = formatFee(1500, "USD");
    expect(out).toMatch(/1,500/);
  });
});

describe("isValidSlug", () => {
  it("accepts valid lowercase slugs", () => {
    expect(isValidSlug("university-of-manchester")).toBe(true);
    expect(isValidSlug("mit")).toBe(true);
    expect(isValidSlug("course-101")).toBe(true);
  });

  it("rejects slugs with uppercase letters", () => {
    expect(isValidSlug("University-of-Manchester")).toBe(false);
    expect(isValidSlug("MIT")).toBe(false);
  });

  it("rejects slugs that start or end with a dash", () => {
    expect(isValidSlug("-university")).toBe(false);
    expect(isValidSlug("university-")).toBe(false);
    expect(isValidSlug("-university-")).toBe(false);
  });

  it("rejects slugs with consecutive dashes", () => {
    expect(isValidSlug("university--of--manchester")).toBe(false);
  });

  it("rejects slugs with non-alphanumeric characters", () => {
    expect(isValidSlug("university_of_manchester")).toBe(false);
    expect(isValidSlug("university.of.manchester")).toBe(false);
    expect(isValidSlug("university of manchester")).toBe(false);
  });

  it("rejects nullish/empty input", () => {
    expect(isValidSlug(null)).toBe(false);
    expect(isValidSlug(undefined)).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});

describe("universitySchema", () => {
  it("requires name and countryId", () => {
    expect(universitySchema.safeParse({}).success).toBe(false);
    expect(universitySchema.safeParse({ name: "X" }).success).toBe(false);
    expect(
      universitySchema.safeParse({ name: "X", countryId: "c1" }).success,
    ).toBe(true);
  });

  it("defaults status to ACTIVE", () => {
    const out = universitySchema.parse({ name: "X", countryId: "c1" });
    expect(out.status).toBe("ACTIVE");
  });

  it("accepts the new city and logo fields", () => {
    const out = universitySchema.safeParse({
      name: "Test University",
      countryId: "c1",
      city: "Manchester",
      logo: "https://example.com/logo.png",
    });
    expect(out.success).toBe(true);
  });

  it("rejects malformed website URLs", () => {
    expect(
      universitySchema.safeParse({
        name: "X",
        countryId: "c1",
        website: "not-a-url",
      }).success,
    ).toBe(false);
  });

  it("accepts an empty website (treated as omitted)", () => {
    expect(
      universitySchema.safeParse({
        name: "X",
        countryId: "c1",
        website: "",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed logo URLs", () => {
    expect(
      universitySchema.safeParse({
        name: "X",
        countryId: "c1",
        logo: "not-a-url",
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive rankings", () => {
    expect(
      universitySchema.safeParse({
        name: "X",
        countryId: "c1",
        ranking: 0,
      }).success,
    ).toBe(false);
    expect(
      universitySchema.safeParse({
        name: "X",
        countryId: "c1",
        ranking: -5,
      }).success,
    ).toBe(false);
  });

  it("rejects negative application fees", () => {
    expect(
      universitySchema.safeParse({
        name: "X",
        countryId: "c1",
        applicationFee: -10,
      }).success,
    ).toBe(false);
  });

  it("caps name at 160 chars", () => {
    expect(
      universitySchema.safeParse({
        name: "x".repeat(161),
        countryId: "c1",
      }).success,
    ).toBe(false);
    expect(
      universitySchema.safeParse({
        name: "x".repeat(160),
        countryId: "c1",
      }).success,
    ).toBe(true);
  });

  it("caps description at 5000 chars", () => {
    expect(
      universitySchema.safeParse({
        name: "X",
        countryId: "c1",
        description: "x".repeat(5001),
      }).success,
    ).toBe(false);
  });

  it("rejects invalid status values", () => {
    expect(
      universitySchema.safeParse({
        name: "X",
        countryId: "c1",
        status: "BANNED",
      }).success,
    ).toBe(false);
  });
});

describe("universityUpdateSchema", () => {
  it("is partial — accepts an empty object", () => {
    expect(universityUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts the archived boolean flag", () => {
    expect(universityUpdateSchema.safeParse({ archived: true }).success).toBe(true);
    expect(universityUpdateSchema.safeParse({ archived: false }).success).toBe(true);
  });

  it("still validates fields when supplied", () => {
    expect(
      universityUpdateSchema.safeParse({ name: "X", ranking: 0 }).success,
    ).toBe(false);
    expect(
      universityUpdateSchema.safeParse({ name: "X", ranking: 5 }).success,
    ).toBe(true);
  });

  it("accepts partial updates with multiple fields", () => {
    expect(
      universityUpdateSchema.safeParse({
        name: "Updated Name",
        status: "INACTIVE",
        applicationFee: 200,
      }).success,
    ).toBe(true);
  });

  it("does NOT accept a slug field (slug is immutable on update)", () => {
    // Zod's default behaviour is to strip unknown keys, so safeParse
    // succeeds — but the parsed output should NOT carry the slug.
    const parsed = universityUpdateSchema.safeParse({
      slug: "should-be-ignored",
      name: "X",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("slug");
    }
  });
});
