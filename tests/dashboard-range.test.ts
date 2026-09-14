import { describe, it, expect } from "vitest";
import { resolveRange, DASHBOARD_RANGES } from "@/lib/utils/dashboard-range";

describe("resolveRange (dashboard API range parsing)", () => {
  it("resolves every preset to a non-future lower bound", () => {
    for (const preset of DASHBOARD_RANGES) {
      const { from, label } = resolveRange({ range: preset });
      expect(from.getTime()).toBeLessThanOrEqual(Date.now());
      expect(label).toBe(preset);
    }
  });

  it("today resolves to the start of the current local day", () => {
    const { from } = resolveRange({ range: "today" });
    const now = new Date();
    expect(from.getFullYear()).toBe(now.getFullYear());
    expect(from.getMonth()).toBe(now.getMonth());
    expect(from.getDate()).toBe(now.getDate());
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
  });

  it("7d resolves to roughly seven days ago", () => {
    const { from } = resolveRange({ range: "7d" });
    const diffDays = (Date.now() - from.getTime()) / 86400_000;
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.01);
  });

  it("accepts a custom from/to window", () => {
    const from = "2026-01-01";
    const to = "2026-03-31";
    const r = resolveRange({ range: "custom", from, to });
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(r.label).toContain("2026-01-01");
    expect(r.label).toContain("2026-03-31");
  });

  it("defaults custom window to 30 days when only 'to' is given", () => {
    const to = "2026-06-30T00:00:00.000Z";
    const r = resolveRange({ to });
    const diffDays = (new Date(to).getTime() - r.from.getTime()) / 86400_000;
    expect(diffDays).toBeCloseTo(30, 1);
  });

  it("falls back to the default preset for invalid or reversed ranges", () => {
    // unknown preset
    expect(resolveRange({ range: "bogus" }).label).toBe("30d");
    // reversed custom window
    expect(resolveRange({ from: "2026-05-01", to: "2026-01-01" }).label).toBe("30d");
    // malformed dates
    expect(resolveRange({ from: "not-a-date", to: "also-bad" }).label).toBe("30d");
  });

  it("respects an explicit fallback preset", () => {
    expect(resolveRange({ range: "nope" }, "7d").label).toBe("7d");
  });
});
