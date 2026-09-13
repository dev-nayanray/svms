import { describe, it, expect } from "vitest";
import {
  resolveDashboardRange,
  dateRangeWhere,
  DASHBOARD_RANGE_PRESETS,
  type DashboardRangePreset,
} from "@/lib/utils/dashboard-range";

// All "now" timestamps in tests are fixed so assertions are deterministic.
const NOW = new Date("2026-08-15T10:30:00Z");

describe("resolveDashboardRange — preset resolution", () => {
  it("defaults to 30d when no preset is supplied", () => {
    const r = resolveDashboardRange({ now: NOW });
    expect(r.preset).toBe("30d");
    expect(r.label).toBe("Last 30 days");
    // 30 days back from NOW
    const expectedFromMs = NOW.getTime() - 30 * 24 * 60 * 60 * 1000;
    expect(r.from.getTime()).toBe(expectedFromMs);
    expect(r.to).toBe(NOW);
  });

  it("rejects unknown presets and falls back to 30d", () => {
    const r = resolveDashboardRange({ preset: "all-time", now: NOW });
    expect(r.preset).toBe("30d");
  });

  it("resolves each preset in the canonical list", () => {
    for (const preset of DASHBOARD_RANGE_PRESETS) {
      if (preset === "custom") continue;
      const r = resolveDashboardRange({ preset, now: NOW });
      expect(r.preset).toBe(preset as DashboardRangePreset);
      expect(r.from).toBeInstanceOf(Date);
      expect(r.to).toBeInstanceOf(Date);
      expect(r.from.getTime()).toBeLessThanOrEqual(r.to.getTime());
    }
  });
});

describe("resolveDashboardRange — today preset (timezone aware)", () => {
  it("Today in UTC starts at 00:00 UTC and ends at 23:59:59.999 UTC", () => {
    const r = resolveDashboardRange({ preset: "today", tz: "UTC", now: NOW });
    expect(r.label).toBe("Today");
    expect(r.from.getUTCHours()).toBe(0);
    expect(r.from.getUTCDate()).toBe(15);
    expect(r.from.getUTCMonth()).toBe(7); // August = 7
    expect(r.to.getUTCHours()).toBe(23);
    expect(r.to.getUTCMinutes()).toBe(59);
  });

  it("Today in Asia/Dhaka (UTC+6) starts at 18:00 UTC the previous day", () => {
    // 2026-08-15T10:30 UTC is 2026-08-15T16:30 in Dhaka → still 15 Aug.
    // Midnight 15 Aug in Dhaka = 2026-08-14T18:00 UTC.
    const r = resolveDashboardRange({ preset: "today", tz: "Asia/Dhaka", now: NOW });
    expect(r.from.toISOString()).toBe("2026-08-14T18:00:00.000Z");
  });

  it("Today in America/New_York (UTC-4 in Aug) starts at 04:00 UTC same day", () => {
    // Midnight 15 Aug in NY EDT = 2026-08-15T04:00 UTC.
    const r = resolveDashboardRange({ preset: "today", tz: "America/New_York", now: NOW });
    expect(r.from.toISOString()).toBe("2026-08-15T04:00:00.000Z");
  });

  it("rejects an unknown tz and falls back to UTC", () => {
    const r = resolveDashboardRange({ preset: "today", tz: "Fake/Zone", now: NOW });
    expect(r.from.getUTCHours()).toBe(0);
  });
});

describe("resolveDashboardRange — this year preset", () => {
  it("Year preset spans Jan 1 to Dec 31 of the current year", () => {
    const r = resolveDashboardRange({ preset: "year", now: NOW });
    expect(r.label).toBe("2026");
    expect(r.from.getUTCFullYear()).toBe(2026);
    expect(r.from.getUTCMonth()).toBe(0); // January
    expect(r.from.getUTCDate()).toBe(1);
    expect(r.to.getUTCFullYear()).toBe(2026);
    expect(r.to.getUTCMonth()).toBe(11); // December
    expect(r.to.getUTCDate()).toBe(31);
  });
});

describe("resolveDashboardRange — custom range", () => {
  it("accepts a valid custom from/to range", () => {
    const r = resolveDashboardRange({
      preset: "custom",
      from: "2026-08-01T00:00:00Z",
      to: "2026-08-31T23:59:59Z",
      now: NOW,
    });
    expect(r.preset).toBe("custom");
    expect(r.from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-08-31T23:59:59.000Z");
    expect(r.label).toMatch(/Aug/);
  });

  it("falls back to 30d when from is missing", () => {
    const r = resolveDashboardRange({ preset: "custom", to: "2026-08-31T00:00:00Z", now: NOW });
    expect(r.preset).toBe("30d");
  });

  it("falls back to 30d when from > to (inverted range)", () => {
    const r = resolveDashboardRange({
      preset: "custom",
      from: "2026-08-31T00:00:00Z",
      to: "2026-08-01T00:00:00Z",
      now: NOW,
    });
    expect(r.preset).toBe("30d");
  });

  it("falls back to 30d when dates are invalid strings", () => {
    const r = resolveDashboardRange({
      preset: "custom",
      from: "not-a-date",
      to: "still-not-a-date",
      now: NOW,
    });
    expect(r.preset).toBe("30d");
  });
});

describe("dateRangeWhere", () => {
  it("builds a gte/lte where fragment for a Prisma DateTime column", () => {
    const range = resolveDashboardRange({ preset: "7d", now: NOW });
    const w = dateRangeWhere("dueDate", range);
    expect(w).toEqual({
      dueDate: { gte: range.from, lte: range.to },
    });
  });

  it("can be spread into an existing where clause without clobbering siblings", () => {
    const range = resolveDashboardRange({ preset: "today", now: NOW });
    const where = { ...dateRangeWhere("createdAt", range), status: "NEW" };
    expect(where).toMatchObject({
      createdAt: { gte: range.from, lte: range.to },
      status: "NEW",
    });
  });
});
