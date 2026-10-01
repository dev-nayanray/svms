import { describe, it, expect } from "vitest";
import {
  validateAnalyticsConfig,
  type AnalyticsValidationResult,
} from "@/lib/system/analytics";

describe("Analytics Configuration Validation", () => {
  describe("validateAnalyticsConfig", () => {
    it("passes with valid GA4 measurement ID", () => {
      const result = validateAnalyticsConfig({ ga4MeasurementId: "G-ABC123XYZ" });
      const ga4 = result.find((r) => r.field === "ga4.measurementId");
      expect(ga4?.valid).toBe(true);
    });

    it("fails with invalid GA4 measurement ID", () => {
      const result = validateAnalyticsConfig({ ga4MeasurementId: "abc" });
      const ga4 = result.find((r) => r.field === "ga4.measurementId");
      expect(ga4?.valid).toBe(false);
      expect(ga4?.message).toContain("G-XXXXXXXX");
    });

    it("passes with valid GTM container ID", () => {
      const result = validateAnalyticsConfig({ gtmContainerId: "GTM-ABC1234" });
      const gtm = result.find((r) => r.field === "gtm.containerId");
      expect(gtm?.valid).toBe(true);
    });

    it("fails with invalid GTM container ID", () => {
      const result = validateAnalyticsConfig({ gtmContainerId: "GTM-XX" });
      const gtm = result.find((r) => r.field === "gtm.containerId");
      expect(gtm?.valid).toBe(false);
    });

    it("passes with valid Meta Pixel ID", () => {
      const result = validateAnalyticsConfig({ metaPixelId: "1234567890123456" });
      const meta = result.find((r) => r.field === "meta.pixelId");
      expect(meta?.valid).toBe(true);
    });

    it("fails with invalid Meta Pixel ID (too short)", () => {
      const result = validateAnalyticsConfig({ metaPixelId: "123" });
      const meta = result.find((r) => r.field === "meta.pixelId");
      expect(meta?.valid).toBe(false);
    });

    it("fails with non-numeric Meta Pixel ID", () => {
      const result = validateAnalyticsConfig({ metaPixelId: "abcdefghijklmnop" });
      const meta = result.find((r) => r.field === "meta.pixelId");
      expect(meta?.valid).toBe(false);
    });

    it("returns empty array when no IDs are provided", () => {
      const result = validateAnalyticsConfig({});
      expect(result).toEqual([]);
    });

    it("validates all providers at once", () => {
      const result: AnalyticsValidationResult[] = validateAnalyticsConfig({
        ga4MeasurementId: "G-VALID123",
        gtmContainerId: "GTM-VALID1",
        metaPixelId: "1234567890123456",
      });
      expect(result.every((r) => r.valid)).toBe(true);
      expect(result.length).toBe(3);
    });
  });
});
