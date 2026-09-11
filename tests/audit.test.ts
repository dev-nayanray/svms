import { describe, it, expect } from "vitest";
import {
  AUDIT_ENTITY_TYPES,
  AUDIT_ENTITY_LABELS,
  AUDIT_ACTION_CATEGORIES,
  buildAuditWhere,
  formatJsonValue,
  isSecuritySensitiveAction,
} from "@/lib/constants/audit";

describe("audit entity types", () => {
  it("includes all 6 documented entity types for per-entity timelines", () => {
    expect(AUDIT_ENTITY_TYPES).toContain("Student");
    expect(AUDIT_ENTITY_TYPES).toContain("Application");
    expect(AUDIT_ENTITY_TYPES).toContain("Payment");
    expect(AUDIT_ENTITY_TYPES).toContain("Invoice");
    expect(AUDIT_ENTITY_TYPES).toContain("Document");
    expect(AUDIT_ENTITY_TYPES).toContain("Employee");
  });

  it("includes additional entity types for comprehensive coverage", () => {
    expect(AUDIT_ENTITY_TYPES).toContain("University");
    expect(AUDIT_ENTITY_TYPES).toContain("Course");
    expect(AUDIT_ENTITY_TYPES).toContain("Country");
    expect(AUDIT_ENTITY_TYPES).toContain("Branch");
    expect(AUDIT_ENTITY_TYPES).toContain("VisaApplication");
    expect(AUDIT_ENTITY_TYPES).toContain("Task");
    expect(AUDIT_ENTITY_TYPES).toContain("SystemSetting");
  });

  it("labels every entity type", () => {
    for (const type of AUDIT_ENTITY_TYPES) {
      expect(AUDIT_ENTITY_LABELS[type]).toBeDefined();
      expect(AUDIT_ENTITY_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});

describe("audit action categories", () => {
  it("has at least 8 categories", () => {
    expect(AUDIT_ACTION_CATEGORIES.length).toBeGreaterThanOrEqual(8);
  });

  it("includes finance and auth categories", () => {
    const keys = AUDIT_ACTION_CATEGORIES.map((c) => c.key);
    expect(keys).toContain("finance");
    expect(keys).toContain("auth");
  });

  it("every category has a key, label, and pattern", () => {
    for (const cat of AUDIT_ACTION_CATEGORIES) {
      expect(cat.key.length).toBeGreaterThan(0);
      expect(cat.label.length).toBeGreaterThan(0);
      expect(cat.pattern).toBeInstanceOf(RegExp);
    }
  });
});

describe("buildAuditWhere", () => {
  it("returns empty for no filters", () => {
    const where = buildAuditWhere({});
    expect(where).toEqual({});
  });

  it("applies userId filter", () => {
    const where = buildAuditWhere({ userId: "u1" });
    expect(where.AND).toContainEqual({ userId: "u1" });
  });

  it("applies action filter as case-insensitive contains", () => {
    const where = buildAuditWhere({ action: "created" });
    expect(where.AND).toContainEqual({
      action: { contains: "created", mode: "insensitive" },
    });
  });

  it("applies entity filter as exact match", () => {
    const where = buildAuditWhere({ entity: "Student" });
    expect(where.AND).toContainEqual({ entity: "Student" });
  });

  it("applies entityId filter", () => {
    const where = buildAuditWhere({ entityId: "ent-1" });
    expect(where.AND).toContainEqual({ entityId: "ent-1" });
  });

  it("builds a date range filter on createdAt (both bounds)", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-12-31");
    const where = buildAuditWhere({ dateFrom: from, dateTo: to });
    expect(where.AND).toContainEqual({ createdAt: { gte: from, lte: to } });
  });

  it("supports a single-sided date range (from only)", () => {
    const from = new Date("2026-01-01");
    const where = buildAuditWhere({ dateFrom: from });
    expect(where.AND).toContainEqual({ createdAt: { gte: from } });
  });

  it("supports a single-sided date range (to only)", () => {
    const to = new Date("2026-12-31");
    const where = buildAuditWhere({ dateTo: to });
    expect(where.AND).toContainEqual({ createdAt: { lte: to } });
  });

  it("searches across action and entity (OR)", () => {
    const where = buildAuditWhere({ search: "payment" });
    expect(where.AND).toContainEqual({
      OR: [
        { action: { contains: "payment", mode: "insensitive" } },
        { entity: { contains: "payment", mode: "insensitive" } },
      ],
    });
  });

  it("trims whitespace from search", () => {
    const where = buildAuditWhere({ search: "  created  " });
    expect(where.AND).toContainEqual({
      OR: [
        { action: { contains: "created", mode: "insensitive" } },
        { entity: { contains: "created", mode: "insensitive" } },
      ],
    });
  });

  it("combines all filters into a single AND chain", () => {
    const where = buildAuditWhere({
      userId: "u1",
      action: "created",
      entity: "Student",
      entityId: "ent-1",
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-12-31"),
      search: "test",
    });
    // 1 (userId) + 1 (action) + 1 (entity) + 1 (entityId) + 1 (date) + 1 (search)
    expect(where.AND).toHaveLength(6);
  });
});

describe("formatJsonValue", () => {
  it("returns '—' for null/undefined", () => {
    expect(formatJsonValue(null)).toBe("—");
    expect(formatJsonValue(undefined)).toBe("—");
  });

  it("returns the string as-is for short strings", () => {
    expect(formatJsonValue("hello")).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    const long = "a".repeat(300);
    const result = formatJsonValue(long, 50);
    expect(result.length).toBe(51); // 50 chars + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  it("JSON-stringifies objects", () => {
    expect(formatJsonValue({ name: "test" })).toBe('{"name":"test"}');
  });

  it("JSON-stringifies arrays", () => {
    expect(formatJsonValue([1, 2, 3])).toBe("[1,2,3]");
  });

  it("returns numbers as strings", () => {
    expect(formatJsonValue(42)).toBe("42");
  });

  it("returns booleans as strings", () => {
    expect(formatJsonValue(true)).toBe("true");
    expect(formatJsonValue(false)).toBe("false");
  });
});

describe("isSecuritySensitiveAction", () => {
  it("identifies payment actions as security-sensitive", () => {
    expect(isSecuritySensitiveAction("payment.recorded")).toBe(true);
    expect(isSecuritySensitiveAction("payment.refunded")).toBe(true);
    expect(isSecuritySensitiveAction("payment.updated")).toBe(true);
  });

  it("identifies invoice actions as security-sensitive", () => {
    expect(isSecuritySensitiveAction("invoice.created")).toBe(true);
    expect(isSecuritySensitiveAction("invoice.updated")).toBe(true);
    expect(isSecuritySensitiveAction("invoice.archived")).toBe(true);
  });

  it("identifies setting changes as security-sensitive", () => {
    expect(isSecuritySensitiveAction("setting.updated")).toBe(true);
  });

  it("identifies employee role assignment as security-sensitive", () => {
    expect(isSecuritySensitiveAction("employee.role_assigned")).toBe(true);
    expect(isSecuritySensitiveAction("employee.access_reset")).toBe(true);
    expect(isSecuritySensitiveAction("employee.created")).toBe(true);
  });

  it("identifies branch management as security-sensitive", () => {
    expect(isSecuritySensitiveAction("branch.created")).toBe(true);
    expect(isSecuritySensitiveAction("branch.updated")).toBe(true);
  });

  it("does NOT identify student document upload as security-sensitive", () => {
    expect(isSecuritySensitiveAction("document.uploaded")).toBe(false);
    expect(isSecuritySensitiveAction("document.approved")).toBe(false);
  });

  it("does NOT identify task actions as security-sensitive", () => {
    expect(isSecuritySensitiveAction("task.created")).toBe(false);
    expect(isSecuritySensitiveAction("task.completed")).toBe(false);
  });

  it("does NOT identify lead actions as security-sensitive", () => {
    expect(isSecuritySensitiveAction("lead.converted")).toBe(false);
  });

  it("does NOT identify unknown actions as security-sensitive", () => {
    expect(isSecuritySensitiveAction("unknown.action")).toBe(false);
    expect(isSecuritySensitiveAction("")).toBe(false);
  });
});
