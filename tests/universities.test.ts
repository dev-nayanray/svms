import { describe, it, expect } from "vitest";
import {
  UNIVERSITY_VISIBILITY_STATUSES,
  STUDENT_UNIVERSITY_SORTS,
  isUniversityVisibleToStudent,
  buildStudentUniversityWhere,
  resolveUniversityOrderBy,
  formatApplicationFee,
  rankingTier,
  resolveUniversityLogo,
  universityInitials,
} from "@/lib/constants/universities";
import {
  studentUniversityQuerySchema,
  counselingRequestSchema,
  favoriteToggleSchema,
  universitySchema,
} from "@/lib/validations";

describe("university visibility enums", () => {
  it("exposes ACTIVE as the only visibility status", () => {
    expect(UNIVERSITY_VISIBILITY_STATUSES).toEqual(["ACTIVE"]);
  });

  it("exposes a stable sort allow-list", () => {
    expect(STUDENT_UNIVERSITY_SORTS).toEqual([
      "name",
      "ranking",
      "applicationFee",
      "createdAt",
    ]);
  });
});

describe("isUniversityVisibleToStudent", () => {
  const activeCountry = { status: "ACTIVE", deletedAt: null };

  it("returns true for an ACTIVE university in an ACTIVE country", () => {
    expect(
      isUniversityVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        country: activeCountry,
      }),
    ).toBe(true);
  });

  it("returns false for an INACTIVE university", () => {
    expect(
      isUniversityVisibleToStudent({
        status: "INACTIVE",
        deletedAt: null,
        country: activeCountry,
      }),
    ).toBe(false);
  });

  it("returns false for a soft-deleted university even if status is ACTIVE", () => {
    expect(
      isUniversityVisibleToStudent({
        status: "ACTIVE",
        deletedAt: new Date(),
        country: activeCountry,
      }),
    ).toBe(false);
  });

  it("returns false when the parent country is INACTIVE", () => {
    expect(
      isUniversityVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        country: { status: "INACTIVE", deletedAt: null },
      }),
    ).toBe(false);
  });

  it("returns false when the parent country is soft-deleted", () => {
    expect(
      isUniversityVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        country: { status: "ACTIVE", deletedAt: new Date() },
      }),
    ).toBe(false);
  });

  it("returns false when the country relation is missing entirely", () => {
    expect(
      isUniversityVisibleToStudent({
        status: "ACTIVE",
        deletedAt: null,
        country: null,
      }),
    ).toBe(false);
    expect(
      isUniversityVisibleToStudent({ status: "ACTIVE", deletedAt: null }),
    ).toBe(false);
  });
});

describe("buildStudentUniversityWhere", () => {
  it("always enforces the visibility predicates", () => {
    const where = buildStudentUniversityWhere({});
    expect(where.AND).toEqual([
      { deletedAt: null, status: "ACTIVE" },
      { country: { deletedAt: null, status: "ACTIVE" } },
    ]);
  });

  it("applies the search term across name, city, and country name", () => {
    const where = buildStudentUniversityWhere({ search: "Toronto" });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "Toronto", mode: "insensitive" } },
        { city: { contains: "Toronto", mode: "insensitive" } },
        { country: { name: { contains: "Toronto", mode: "insensitive" } } },
      ],
    });
  });

  it("trims whitespace from search and city before filtering", () => {
    const where = buildStudentUniversityWhere({ search: "  Manchester  " });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "Manchester", mode: "insensitive" } },
        { city: { contains: "Manchester", mode: "insensitive" } },
        { country: { name: { contains: "Manchester", mode: "insensitive" } } },
      ],
    });
  });

  it("applies country + city + ranking filters as AND clauses", () => {
    const where = buildStudentUniversityWhere({
      countryId: "c1",
      city: "Sydney",
      rankingMax: 100,
    });
    expect(where.AND).toContainEqual({ countryId: "c1" });
    expect(where.AND).toContainEqual({
      city: { contains: "Sydney", mode: "insensitive" },
    });
    expect(where.AND).toContainEqual({ ranking: { lte: 100 } });
  });

  it("filters by course membership", () => {
    const where = buildStudentUniversityWhere({ courseId: "course-1" });
    expect(where.AND).toContainEqual({
      courses: { some: { id: "course-1", deletedAt: null } },
    });
  });

  it("filters by intake via course.intakes join", () => {
    const where = buildStudentUniversityWhere({ intakeId: "intake-1" });
    expect(where.AND).toContainEqual({
      courses: { some: { intakes: { some: { id: "intake-1" } } } },
    });
  });

  it("favoriteOnly with favorites restricts to that set", () => {
    const where = buildStudentUniversityWhere({
      favoriteOnly: true,
      favoriteUniversityIds: ["u1", "u2"],
    });
    expect(where.AND).toContainEqual({ id: { in: ["u1", "u2"] } });
  });

  it("favoriteOnly with no favorites is an impossible match (empty in list)", () => {
    const where = buildStudentUniversityWhere({
      favoriteOnly: true,
      favoriteUniversityIds: [],
    });
    expect(where.AND).toContainEqual({ id: { in: [] } });
  });

  it("does not add favorite clauses when favoriteOnly is false", () => {
    const where = buildStudentUniversityWhere({
      favoriteOnly: false,
      favoriteUniversityIds: ["u1"],
    });
    const json = JSON.stringify(where);
    expect(json).not.toContain('"id":{"in"');
  });
});

describe("resolveUniversityOrderBy", () => {
  it("sorts by name asc by default and for explicit name", () => {
    expect(resolveUniversityOrderBy()).toEqual({ name: "asc" });
    expect(resolveUniversityOrderBy("name")).toEqual({ name: "asc" });
  });

  it("sorts ranking ascending (lower = better)", () => {
    expect(resolveUniversityOrderBy("ranking")).toEqual({ ranking: "asc" });
  });

  it("sorts applicationFee descending", () => {
    expect(resolveUniversityOrderBy("applicationFee")).toEqual({
      applicationFee: "desc",
    });
  });

  it("sorts createdAt descending (newest first)", () => {
    expect(resolveUniversityOrderBy("createdAt")).toEqual({ createdAt: "desc" });
  });

  it("falls back to name asc for unknown sort keys", () => {
    expect(resolveUniversityOrderBy("unknown")).toEqual({ name: "asc" });
  });
});

describe("formatApplicationFee", () => {
  it("returns em-dash for null/undefined", () => {
    expect(formatApplicationFee(null)).toBe("—");
    expect(formatApplicationFee(undefined)).toBe("—");
  });

  it("formats USD with no decimals", () => {
    expect(formatApplicationFee(125, "USD")).toMatch(/125/);
    expect(formatApplicationFee(125, "USD")).not.toMatch(/\.\d+/);
  });

  it("falls back to plain number when currency is invalid", () => {
    // An invalid currency code throws inside Intl.NumberFormat and we
    // catch and return the raw value with the currency prefix.
    const out = formatApplicationFee(125, "NOTACURRENCY");
    expect(out).toContain("125");
  });
});

describe("rankingTier", () => {
  it("returns null for missing or non-positive rankings", () => {
    expect(rankingTier(null)).toBeNull();
    expect(rankingTier(undefined)).toBeNull();
    expect(rankingTier(0)).toBeNull();
    expect(rankingTier(-5)).toBeNull();
  });

  it("labels top-50 universities as 'top'", () => {
    expect(rankingTier(1)).toBe("top");
    expect(rankingTier(50)).toBe("top");
  });

  it("labels 51-200 as 'leading'", () => {
    expect(rankingTier(51)).toBe("leading");
    expect(rankingTier(200)).toBe("leading");
  });

  it("labels anything above 200 as 'established'", () => {
    expect(rankingTier(201)).toBe("established");
    expect(rankingTier(500)).toBe("established");
  });
});

describe("resolveUniversityLogo", () => {
  it("returns null for empty input", () => {
    expect(resolveUniversityLogo(null)).toBeNull();
    expect(resolveUniversityLogo(undefined)).toBeNull();
    expect(resolveUniversityLogo("")).toBeNull();
  });

  it("returns absolute URLs as-is", () => {
    expect(resolveUniversityLogo("https://example.com/logo.png")).toBe(
      "https://example.com/logo.png",
    );
  });

  it("returns relative paths starting with / as-is", () => {
    expect(resolveUniversityLogo("/logos/u1.png")).toBe("/logos/u1.png");
  });

  it("returns null for strings that aren't URLs or paths", () => {
    expect(resolveUniversityLogo("not-a-url")).toBeNull();
  });

  it("accepts ftp: URLs (the URL constructor allows non-http schemes)", () => {
    // The helper intentionally doesn't filter by protocol — the consumer
    // (admin form) is responsible for vetting logo URLs at input time.
    expect(resolveUniversityLogo("ftp://example.com")).toBe("ftp://example.com/");
  });
});

describe("universityInitials", () => {
  it("strips common corporate suffixes ('university', 'institute', 'college', 'school', 'of', 'the')", () => {
    // "University of Toronto" — strips "University" and "of", leaving
    // "Toronto" → "T". The intent is to drop generic corporate words so
    // the initials reflect the unique part of the name.
    expect(universityInitials("University of Toronto")).toBe("T");
    // "Massachusetts Institute of Technology" — strips "Institute" and "of",
    // leaving "Massachusetts Technology" → "MT".
    expect(universityInitials("Massachusetts Institute of Technology")).toBe("MT");
    // "Harvard College" — strips "College", leaving "Harvard" → "H".
    expect(universityInitials("Harvard College")).toBe("H");
  });

  it("returns up to 2 uppercase chars from the first 2 surviving words", () => {
    expect(universityInitials("Oxford")).toBe("O");
    expect(universityInitials("Cambridge Berkeley")).toBe("CB");
    // More than 2 words — only first 2 contribute
    expect(universityInitials("Cambridge Berkeley Oxford")).toBe("CB");
  });

  it("falls back to the first letters of the original name when stripping removes everything", () => {
    // "University" — strips to empty, so falls back to the original name.
    expect(universityInitials("University")).toBe("U");
    // "The University of the Future" — strips "The", "University", "of",
    // "the", leaving "Future" → "F".
    expect(universityInitials("The University of the Future")).toBe("F");
  });
});

describe("studentUniversityQuerySchema", () => {
  it("parses a complete filter query", () => {
    const out = studentUniversityQuerySchema.parse({
      page: 2,
      pageSize: 12,
      search: "Toronto",
      countryId: "c1",
      city: "Toronto",
      rankingMax: 100,
      courseId: "course-1",
      intakeId: "intake-1",
      favoriteOnly: "true",
      sortBy: "ranking",
    });
    expect(out.page).toBe(2);
    expect(out.favoriteOnly).toBe(true);
    expect(out.sortBy).toBe("ranking");
    expect(out.rankingMax).toBe(100);
  });

  it("defaults page and pageSize when missing", () => {
    const out = studentUniversityQuerySchema.parse({});
    expect(out.page).toBe(1);
    expect(out.pageSize).toBe(20);
  });

  it("rejects pageSize above 100 (capped at 100, not clamped)", () => {
    // The schema uses .max(100) which rejects rather than clamping — this
    // is intentional so the API returns a 422 instead of silently serving
    // more rows than the contract allows.
    expect(
      studentUniversityQuerySchema.safeParse({ pageSize: 500 }).success,
    ).toBe(false);
    expect(
      studentUniversityQuerySchema.safeParse({ pageSize: 100 }).success,
    ).toBe(true);
  });

  it("rejects negative page numbers", () => {
    expect(studentUniversityQuerySchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it("rejects non-positive rankingMax", () => {
    expect(
      studentUniversityQuerySchema.safeParse({ rankingMax: 0 }).success,
    ).toBe(false);
    expect(
      studentUniversityQuerySchema.safeParse({ rankingMax: -10 }).success,
    ).toBe(false);
  });

  it("rejects unknown sortBy values", () => {
    expect(
      studentUniversityQuerySchema.safeParse({ sortBy: "random" }).success,
    ).toBe(false);
  });

  it("accepts favoriteOnly=false as well as true", () => {
    expect(
      studentUniversityQuerySchema.safeParse({ favoriteOnly: "false" }).success,
    ).toBe(true);
    // Booleans also coerce cleanly
    expect(
      studentUniversityQuerySchema.safeParse({ favoriteOnly: false }).success,
    ).toBe(true);
  });
});

describe("counselingRequestSchema", () => {
  it("requires universityId", () => {
    expect(counselingRequestSchema.safeParse({}).success).toBe(false);
    expect(
      counselingRequestSchema.safeParse({ universityId: "u1" }).success,
    ).toBe(true);
  });

  it("accepts optional courseId and message", () => {
    const out = counselingRequestSchema.parse({
      universityId: "u1",
      courseId: "c1",
      message: "I'm interested in your MSc program",
    });
    expect(out.courseId).toBe("c1");
    expect(out.message).toContain("MSc");
  });

  it("rejects messages longer than 2000 chars", () => {
    const long = "a".repeat(2001);
    expect(
      counselingRequestSchema.safeParse({
        universityId: "u1",
        message: long,
      }).success,
    ).toBe(false);
  });
});

describe("favoriteToggleSchema", () => {
  it("requires universityId", () => {
    expect(favoriteToggleSchema.safeParse({}).success).toBe(false);
    expect(
      favoriteToggleSchema.safeParse({ universityId: "u1" }).success,
    ).toBe(true);
  });
});

describe("universitySchema (admin create)", () => {
  it("accepts the new city and logo fields", () => {
    const out = universitySchema.safeParse({
      name: "Test University",
      countryId: "c1",
      city: "Manchester",
      logo: "https://example.com/logo.png",
    });
    expect(out.success).toBe(true);
  });

  it("rejects malformed logo URLs", () => {
    expect(
      universitySchema.safeParse({
        name: "Test",
        countryId: "c1",
        logo: "not-a-url",
      }).success,
    ).toBe(false);
  });

  it("accepts an empty logo (treated as omitted)", () => {
    expect(
      universitySchema.safeParse({
        name: "Test",
        countryId: "c1",
        logo: "",
      }).success,
    ).toBe(true);
  });

  it("caps description at 5000 chars", () => {
    expect(
      universitySchema.safeParse({
        name: "Test",
        countryId: "c1",
        description: "x".repeat(5001),
      }).success,
    ).toBe(false);
  });

  it("caps city at 120 chars", () => {
    expect(
      universitySchema.safeParse({
        name: "Test",
        countryId: "c1",
        city: "x".repeat(121),
      }).success,
    ).toBe(false);
  });
});
