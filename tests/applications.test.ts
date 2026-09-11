import { describe, it, expect } from "vitest";
import {
  formatApplicationNumber,
  parseApplicationNumber,
  DEFAULT_PIPELINE,
} from "@/lib/constants/applications";
import { applicationSchema } from "@/lib/validations";

describe("formatApplicationNumber (SV-YYYY-XXXXXX)", () => {
  it("formats with zero padding to six digits", () => {
    expect(formatApplicationNumber(2026, 1)).toBe("SV-2026-000001");
    expect(formatApplicationNumber(2026, 42)).toBe("SV-2026-000042");
    expect(formatApplicationNumber(2027, 999999)).toBe("SV-2027-999999");
  });

  it("rejects out-of-range years and sequences", () => {
    expect(() => formatApplicationNumber(1999, 1)).toThrow(RangeError);
    expect(() => formatApplicationNumber(3000, 1)).toThrow(RangeError);
    expect(() => formatApplicationNumber(2026, 0)).toThrow(RangeError);
    expect(() => formatApplicationNumber(2026, 1000000)).toThrow(RangeError);
    expect(() => formatApplicationNumber(2026, 1.5)).toThrow(RangeError);
  });
});

describe("parseApplicationNumber", () => {
  it("round-trips valid numbers", () => {
    const formatted = formatApplicationNumber(2026, 1234);
    expect(parseApplicationNumber(formatted)).toEqual({ year: 2026, sequence: 1234 });
  });

  it("rejects malformed numbers", () => {
    expect(parseApplicationNumber("SV-26-000001")).toBeNull();
    expect(parseApplicationNumber("sv-2026-000001")).toBeNull();
    expect(parseApplicationNumber("SV-2026-1")).toBeNull();
    expect(parseApplicationNumber("APP-2026-000001")).toBeNull();
    expect(parseApplicationNumber("SV-2026-000000")).toBeNull();
  });
});

describe("default pipeline", () => {
  it("starts at LEAD and ends at COMPLETED with 18 unique stages", () => {
    expect(DEFAULT_PIPELINE[0]).toBe("LEAD");
    expect(DEFAULT_PIPELINE[DEFAULT_PIPELINE.length - 1]).toBe("COMPLETED");
    expect(DEFAULT_PIPELINE.length).toBe(18);
    expect(new Set(DEFAULT_PIPELINE).size).toBe(DEFAULT_PIPELINE.length);
  });
});

describe("application schema", () => {
  it("requires student and country", () => {
    expect(applicationSchema.safeParse({}).success).toBe(false);
    expect(applicationSchema.safeParse({ studentId: "s" }).success).toBe(false);
    expect(applicationSchema.safeParse({ studentId: "s", countryId: "c" }).success).toBe(true);
  });

  it("defaults priority to MEDIUM and enforces the enum", () => {
    expect(applicationSchema.parse({ studentId: "s", countryId: "c" }).priority).toBe("MEDIUM");
    expect(applicationSchema.safeParse({ studentId: "s", countryId: "c", priority: "NOW" }).success).toBe(false);
  });
});
