import { describe, it, expect } from "vitest";
import { conversionBlockReason, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants/leads";
import { leadSchema, leadUpdateSchema } from "@/lib/validations";

describe("conversionBlockReason (lead → student guard)", () => {
  const base = { status: "QUALIFIED", email: "lead@example.com" };

  it("allows a healthy lead", () => {
    expect(conversionBlockReason(base)).toBeNull();
  });

  it("blocks already-converted leads (status or link)", () => {
    expect(conversionBlockReason({ ...base, status: "CONVERTED" })).toMatch(/already converted/i);
    expect(
      conversionBlockReason({ ...base, convertedStudentId: "abc" })
    ).toMatch(/already converted/i);
  });

  it("blocks archived leads", () => {
    expect(conversionBlockReason({ ...base, archivedAt: new Date() })).toMatch(/archived/i);
  });

  it("blocks leads without an email", () => {
    expect(conversionBlockReason({ ...base, email: null })).toMatch(/email/i);
    expect(conversionBlockReason({ ...base, email: undefined })).toMatch(/email/i);
  });
});

describe("lead validation schema", () => {
  it("accepts every documented status", () => {
    for (const status of LEAD_STATUSES) {
      expect(leadSchema.safeParse({ name: "A", status }).success).toBe(true);
    }
  });

  it("accepts every documented source", () => {
    for (const source of LEAD_SOURCES) {
      expect(leadSchema.safeParse({ name: "A", source }).success).toBe(true);
    }
  });

  it("rejects invalid statuses and sources server-side", () => {
    expect(leadSchema.safeParse({ name: "A", status: "SUPER" }).success).toBe(false);
    expect(leadSchema.safeParse({ name: "A", source: "TIKTOK" }).success).toBe(false);
  });

  it("requires a name and a valid email when provided", () => {
    expect(leadSchema.safeParse({}).success).toBe(false);
    expect(leadSchema.safeParse({ name: "A", email: "not-an-email" }).success).toBe(false);
    expect(leadSchema.safeParse({ name: "A", email: "" }).success).toBe(true); // empty = unset
  });

  it("update schema supports the archive flag and rejects unknown statuses", () => {
    expect(leadUpdateSchema.safeParse({ archived: true }).success).toBe(true);
    expect(leadUpdateSchema.safeParse({ archived: false }).success).toBe(true);
    expect(leadUpdateSchema.safeParse({ status: "NOPE" }).success).toBe(false);
  });
});
