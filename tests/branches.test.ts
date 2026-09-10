import { describe, it, expect } from "vitest";
import {
  BRANCH_STATUSES,
  BRANCH_STATUS_LABELS,
  BRANCH_SORT_KEYS,
  buildAdminBranchWhere,
  branchArchiveBlockReason,
} from "@/lib/constants/branches";
import {
  branchSchema,
  branchUpdateSchema,
} from "@/lib/validations";

describe("branch enums", () => {
  it("exposes exactly ACTIVE and INACTIVE", () => {
    expect(BRANCH_STATUSES).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("labels every status", () => {
    expect(BRANCH_STATUS_LABELS.ACTIVE).toBe("Active");
    expect(BRANCH_STATUS_LABELS.INACTIVE).toBe("Inactive");
  });

  it("exposes a stable sort allow-list", () => {
    expect(BRANCH_SORT_KEYS).toEqual(["name", "code", "status", "createdAt"]);
  });
});

describe("buildAdminBranchWhere", () => {
  it("filters by deletedAt null when archived=false (default)", () => {
    const where = buildAdminBranchWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("filters by deletedAt not-null when archived=true", () => {
    const where = buildAdminBranchWhere({ archived: true });
    expect(where.AND).toContainEqual({ deletedAt: { not: null } });
  });

  it("applies status filter", () => {
    const where = buildAdminBranchWhere({ status: "ACTIVE" });
    expect(where.AND).toContainEqual({ status: "ACTIVE" });
  });

  it("searches across name, code, and address", () => {
    const where = buildAdminBranchWhere({ search: "Dhaka" });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "Dhaka", mode: "insensitive" } },
        { code: { contains: "Dhaka", mode: "insensitive" } },
        { address: { contains: "Dhaka", mode: "insensitive" } },
      ],
    });
  });

  it("trims whitespace from search", () => {
    const where = buildAdminBranchWhere({ search: "  HQ  " });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "HQ", mode: "insensitive" } },
        { code: { contains: "HQ", mode: "insensitive" } },
        { address: { contains: "HQ", mode: "insensitive" } },
      ],
    });
  });

  it("omits status clause when status is undefined", () => {
    const where = buildAdminBranchWhere({});
    const andClauses = where.AND as Record<string, unknown>[];
    const hasStatusClause = andClauses.some((c) => "status" in c);
    expect(hasStatusClause).toBe(false);
  });

  it("combines archived + status + search into a single AND chain", () => {
    const where = buildAdminBranchWhere({
      archived: false,
      status: "ACTIVE",
      search: "HQ",
    });
    expect(where.AND).toHaveLength(3);
  });
});

describe("branchArchiveBlockReason", () => {
  it("allows archiving when no employees or students are assigned", () => {
    expect(branchArchiveBlockReason({ _count: { employees: 0, students: 0 } })).toBeNull();
    expect(branchArchiveBlockReason({})).toBeNull();
    expect(branchArchiveBlockReason({ _count: {} })).toBeNull();
  });

  it("blocks archiving when employees are assigned", () => {
    const reason = branchArchiveBlockReason({ _count: { employees: 3, students: 0 } });
    expect(reason).toMatch(/3 employee/);
    expect(reason).toMatch(/reassign/i);
  });

  it("blocks archiving when students are assigned", () => {
    const reason = branchArchiveBlockReason({ _count: { employees: 0, students: 5 } });
    expect(reason).toMatch(/5 student/);
    expect(reason).toMatch(/reassign/i);
  });

  it("blocks archiving when both employees and students are assigned", () => {
    const reason = branchArchiveBlockReason({ _count: { employees: 2, students: 7 } });
    expect(reason).toMatch(/2 employee/);
    expect(reason).toMatch(/7 student/);
  });

  it("blocks when already archived", () => {
    expect(branchArchiveBlockReason({ deletedAt: new Date() })).toMatch(/already archived/i);
    expect(
      branchArchiveBlockReason({ deletedAt: "2026-01-01", _count: { employees: 5, students: 10 } }),
    ).toMatch(/already archived/i);
  });
});

describe("branchSchema", () => {
  it("requires name and code", () => {
    expect(branchSchema.safeParse({}).success).toBe(false);
    expect(branchSchema.safeParse({ name: "X" }).success).toBe(false);
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ" }).success,
    ).toBe(true);
  });

  it("defaults status to ACTIVE", () => {
    const out = branchSchema.parse({ name: "X", code: "HQ" });
    expect(out.status).toBe("ACTIVE");
  });

  it("accepts optional managerId", () => {
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ", managerId: "emp-1" }).success,
    ).toBe(true);
  });

  it("accepts optional address, phone, email", () => {
    expect(
      branchSchema.safeParse({
        name: "X",
        code: "HQ",
        address: "123 Main St",
        phone: "+8801700000000",
        email: "branch@example.com",
      }).success,
    ).toBe(true);
  });

  it("rejects codes shorter than 2 characters", () => {
    expect(
      branchSchema.safeParse({ name: "X", code: "A" }).success,
    ).toBe(false);
  });

  it("rejects codes longer than 10 characters", () => {
    expect(
      branchSchema.safeParse({ name: "X", code: "VERYLONGCODE123" }).success,
    ).toBe(false);
  });

  it("rejects codes with special characters (only alphanumeric, dash, underscore)", () => {
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ!" }).success,
    ).toBe(false);
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ @" }).success,
    ).toBe(false);
  });

  it("accepts codes with dashes and underscores", () => {
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ-1" }).success,
    ).toBe(true);
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ_1" }).success,
    ).toBe(true);
  });

  it("rejects invalid statuses", () => {
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ", status: "BANNED" }).success,
    ).toBe(false);
  });

  it("rejects invalid email addresses", () => {
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ", email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("accepts an empty email (treated as omitted)", () => {
    expect(
      branchSchema.safeParse({ name: "X", code: "HQ", email: "" }).success,
    ).toBe(true);
  });

  it("rejects names longer than 120 chars", () => {
    expect(
      branchSchema.safeParse({ name: "x".repeat(121), code: "HQ" }).success,
    ).toBe(false);
  });
});

describe("branchUpdateSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(branchUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts the archived boolean flag", () => {
    expect(branchUpdateSchema.safeParse({ archived: true }).success).toBe(true);
    expect(branchUpdateSchema.safeParse({ archived: false }).success).toBe(true);
  });

  it("still validates fields when supplied", () => {
    expect(
      branchUpdateSchema.safeParse({ code: "A" }).success,
    ).toBe(false);
    expect(
      branchUpdateSchema.safeParse({ code: "HQ" }).success,
    ).toBe(true);
  });

  it("accepts partial updates with multiple fields", () => {
    expect(
      branchUpdateSchema.safeParse({
        name: "Updated Name",
        status: "INACTIVE",
        managerId: "emp-2",
      }).success,
    ).toBe(true);
  });

  it("accepts nullable email and address via empty string", () => {
    expect(
      branchUpdateSchema.safeParse({ email: "", address: "" }).success,
    ).toBe(true);
  });
});
