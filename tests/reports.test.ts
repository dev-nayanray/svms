import { describe, it, expect } from "vitest";
import {
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  SENSITIVE_REPORTS,
  REPORT_FILTER_KEYS,
  isSensitiveReport,
  parseReportFilters,
  filtersToQueryString,
  rowsToCsv,
  resolveDateRange,
  dateRangeLabel,
} from "@/lib/constants/reports";

describe("report type enums", () => {
  it("exposes the 7 canonical report types", () => {
    expect(REPORT_TYPES).toEqual([
      "students",
      "leads",
      "applications",
      "visa",
      "employees",
      "finance",
      "documents",
    ]);
  });

  it("labels every report type", () => {
    expect(REPORT_TYPE_LABELS.students).toBe("Student Reports");
    expect(REPORT_TYPE_LABELS.leads).toBe("Lead Reports");
    expect(REPORT_TYPE_LABELS.applications).toBe("Application Reports");
    expect(REPORT_TYPE_LABELS.visa).toBe("Visa Reports");
    expect(REPORT_TYPE_LABELS.employees).toBe("Employee Reports");
    expect(REPORT_TYPE_LABELS.finance).toBe("Finance Reports");
    expect(REPORT_TYPE_LABELS.documents).toBe("Document Reports");
  });
});

describe("sensitive report detection", () => {
  it("identifies finance and employees as sensitive", () => {
    expect(SENSITIVE_REPORTS).toEqual(["finance", "employees"]);
  });

  it("isSensitiveReport returns true for finance and employees", () => {
    expect(isSensitiveReport("finance")).toBe(true);
    expect(isSensitiveReport("employees")).toBe(true);
  });

  it("isSensitiveReport returns false for non-sensitive reports", () => {
    expect(isSensitiveReport("students")).toBe(false);
    expect(isSensitiveReport("leads")).toBe(false);
    expect(isSensitiveReport("applications")).toBe(false);
    expect(isSensitiveReport("visa")).toBe(false);
    expect(isSensitiveReport("documents")).toBe(false);
  });

  it("isSensitiveReport returns false for unknown types", () => {
    expect(isSensitiveReport("unknown")).toBe(false);
    expect(isSensitiveReport("")).toBe(false);
  });
});

describe("report filter keys", () => {
  it("exposes the canonical filter keys", () => {
    expect(REPORT_FILTER_KEYS).toEqual([
      "dateFrom",
      "dateTo",
      "branchId",
      "employeeId",
      "countryId",
      "universityId",
      "courseId",
      "intakeId",
      "status",
    ]);
  });
});

describe("parseReportFilters", () => {
  it("parses all known filter keys", () => {
    const raw = {
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      branchId: "b1",
      employeeId: "e1",
      countryId: "c1",
      universityId: "u1",
      courseId: "course-1",
      intakeId: "intake-1",
      status: "ACTIVE",
    };
    const parsed = parseReportFilters(raw);
    expect(parsed.dateFrom).toBe("2026-01-01");
    expect(parsed.dateTo).toBe("2026-12-31");
    expect(parsed.branchId).toBe("b1");
    expect(parsed.employeeId).toBe("e1");
    expect(parsed.countryId).toBe("c1");
    expect(parsed.universityId).toBe("u1");
    expect(parsed.courseId).toBe("course-1");
    expect(parsed.intakeId).toBe("intake-1");
    expect(parsed.status).toBe("ACTIVE");
  });

  it("trims whitespace from values", () => {
    const parsed = parseReportFilters({ status: "  ACTIVE  " });
    expect(parsed.status).toBe("ACTIVE");
  });

  it("drops undefined and empty values", () => {
    const parsed = parseReportFilters({
      status: "",
      branchId: undefined,
      dateFrom: "",
    });
    expect(parsed.status).toBeUndefined();
    expect(parsed.branchId).toBeUndefined();
    expect(parsed.dateFrom).toBeUndefined();
  });

  it("ignores unknown keys", () => {
    const parsed = parseReportFilters({
      status: "ACTIVE",
      unknownKey: "value",
    } as Record<string, string | undefined>);
    expect(parsed.status).toBe("ACTIVE");
    expect((parsed as Record<string, unknown>).unknownKey).toBeUndefined();
  });

  it("returns an empty object for no input", () => {
    expect(parseReportFilters({})).toEqual({});
  });
});

describe("filtersToQueryString", () => {
  it("builds a query string from filters", () => {
    const qs = filtersToQueryString({
      dateFrom: "2026-01-01",
      status: "ACTIVE",
    });
    expect(qs).toContain("dateFrom=2026-01-01");
    expect(qs).toContain("status=ACTIVE");
  });

  it("omits empty/undefined values", () => {
    const qs = filtersToQueryString({
      dateFrom: "2026-01-01",
      dateTo: undefined,
      status: "",
    });
    expect(qs).toContain("dateFrom=2026-01-01");
    expect(qs).not.toContain("dateTo");
    expect(qs).not.toContain("status");
  });

  it("returns an empty string for no filters", () => {
    expect(filtersToQueryString({})).toBe("");
  });
});

describe("rowsToCsv", () => {
  it("converts a simple table to CSV", () => {
    const csv = rowsToCsv(
      ["Name", "Count"],
      [
        { Name: "UK", Count: 10 },
        { Name: "Canada", Count: 5 },
      ],
    );
    expect(csv).toBe("Name,Count\r\nUK,10\r\nCanada,5");
  });

  it("escapes values containing commas", () => {
    const csv = rowsToCsv(
      ["Name", "Note"],
      [{ Name: "Smith, John", Note: "OK" }],
    );
    expect(csv).toContain('"Smith, John"');
  });

  it("escapes values containing quotes by doubling them", () => {
    const csv = rowsToCsv(
      ["Name"],
      [{ Name: 'He said "hello"' }],
    );
    expect(csv).toContain('"He said ""hello"""');
  });

  it("escapes values containing newlines", () => {
    const csv = rowsToCsv(
      ["Name"],
      [{ Name: "Line1\nLine2" }],
    );
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("handles null and undefined values as empty strings", () => {
    const csv = rowsToCsv(
      ["A", "B"],
      [{ A: null, B: undefined }],
    );
    expect(csv).toBe("A,B\r\n,");
  });

  it("handles numbers and booleans", () => {
    const csv = rowsToCsv(
      ["Count", "Active"],
      [{ Count: 42, Active: true }],
    );
    expect(csv).toBe("Count,Active\r\n42,true");
  });

  it("handles an empty rows array", () => {
    const csv = rowsToCsv(["Name", "Count"], []);
    expect(csv).toBe("Name,Count");
  });
});

describe("resolveDateRange", () => {
  it("returns null for both when no dates are set", () => {
    const { from, to } = resolveDateRange({});
    expect(from).toBeNull();
    expect(to).toBeNull();
  });

  it("parses valid date strings", () => {
    const { from, to } = resolveDateRange({
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    expect(from!.getFullYear()).toBe(2026);
    expect(to!.getMonth()).toBe(11); // December = month 11
  });

  it("returns null for invalid date strings", () => {
    const { from, to } = resolveDateRange({
      dateFrom: "not-a-date",
      dateTo: "also-invalid",
    });
    expect(from).toBeNull();
    expect(to).toBeNull();
  });

  it("handles partial date ranges (from only)", () => {
    const { from, to } = resolveDateRange({ dateFrom: "2026-01-01" });
    expect(from).not.toBeNull();
    expect(to).toBeNull();
  });

  it("handles partial date ranges (to only)", () => {
    const { from, to } = resolveDateRange({ dateTo: "2026-12-31" });
    expect(from).toBeNull();
    expect(to).not.toBeNull();
  });
});

describe("dateRangeLabel", () => {
  it("returns 'All time' when no dates are set", () => {
    expect(dateRangeLabel({})).toBe("All time");
  });

  it("returns 'From {date}' for a single from date", () => {
    const label = dateRangeLabel({ dateFrom: "2026-01-01" });
    expect(label).toMatch(/From 2026-01-01/);
  });

  it("returns 'To {date}' for a single to date", () => {
    const label = dateRangeLabel({ dateTo: "2026-12-31" });
    expect(label).toMatch(/To 2026-12-31/);
  });

  it("returns '{from} → {to}' for a full range", () => {
    const label = dateRangeLabel({
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });
    expect(label).toMatch(/2026-01-01.*2026-12-31/);
  });

  it("returns 'All time' for invalid dates", () => {
    expect(dateRangeLabel({ dateFrom: "invalid" })).toBe("All time");
  });
});
