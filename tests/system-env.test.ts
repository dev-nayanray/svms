import { describe, it, expect } from "vitest";
import { checkEnvironment, isEnvConfigured } from "@/lib/system/env";

describe("Environment Variable Health Check", () => {
  describe("checkEnvironment", () => {
    it("returns an array of categories", () => {
      const result = checkEnvironment();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.categories.length).toBeGreaterThan(0);
    });

    it("includes Database category with DATABASE_URL", () => {
      const result = checkEnvironment();
      const db = result.categories.find((c) => c.name === "Database");
      expect(db).toBeDefined();
      expect(db?.vars.some((v) => v.key === "DATABASE_URL")).toBe(true);
    });

    it("includes Authentication category with AUTH_SECRET", () => {
      const result = checkEnvironment();
      const auth = result.categories.find((c) => c.name === "Authentication");
      expect(auth).toBeDefined();
      expect(auth?.vars.some((v) => v.key === "AUTH_SECRET")).toBe(true);
    });

    it("includes Backup category with all backup env vars", () => {
      const result = checkEnvironment();
      const backup = result.categories.find((c) => c.name === "Backup");
      expect(backup).toBeDefined();
      const keys = backup?.vars.map((v) => v.key) ?? [];
      expect(keys).toContain("BACKUP_STORAGE_PROVIDER");
      expect(keys).toContain("BACKUP_BUCKET");
      expect(keys).toContain("BACKUP_ACCESS_KEY");
      expect(keys).toContain("BACKUP_SECRET_KEY");
    });

    it("includes Analytics category with GA4 / GTM / Meta", () => {
      const result = checkEnvironment();
      const analytics = result.categories.find((c) => c.name === "Analytics");
      expect(analytics).toBeDefined();
      const keys = analytics?.vars.map((v) => v.key) ?? [];
      expect(keys).toContain("NEXT_PUBLIC_GA4_MEASUREMENT_ID");
      expect(keys).toContain("NEXT_PUBLIC_GTM_CONTAINER_ID");
      expect(keys).toContain("NEXT_PUBLIC_META_PIXEL_ID");
    });

    it("marks secrets as not public", () => {
      const result = checkEnvironment();
      const allVars = result.categories.flatMap((c) => c.vars);
      const authSecret = allVars.find((v) => v.key === "AUTH_SECRET");
      expect(authSecret?.public).toBeFalsy();
    });

    it("marks public IDs as public", () => {
      const result = checkEnvironment();
      const allVars = result.categories.flatMap((c) => c.vars);
      const ga4 = allVars.find((v) => v.key === "NEXT_PUBLIC_GA4_MEASUREMENT_ID");
      expect(ga4?.public).toBe(true);
    });

    it("never returns the actual value of a secret", () => {
      const result = checkEnvironment();
      const allVars = result.categories.flatMap((c) => c.vars);
      const secrets = allVars.filter((v) => !v.public);
      for (const s of secrets) {
        expect(s.value).toBeUndefined();
      }
    });

    it("computes totalConfigured and totalVars", () => {
      const result = checkEnvironment();
      expect(result.totalVars).toBeGreaterThan(0);
      expect(result.totalConfigured).toBeGreaterThanOrEqual(0);
      expect(result.totalConfigured).toBeLessThanOrEqual(result.totalVars);
    });

    it("includes missingCritical list (may be empty)", () => {
      const result = checkEnvironment();
      expect(Array.isArray(result.missingCritical)).toBe(true);
    });
  });

  describe("isEnvConfigured", () => {
    it("returns false for undefined vars", () => {
      expect(isEnvConfigured("NONEXISTENT_VAR_12345")).toBe(false);
    });

    it("returns false for the placeholder value", () => {
      process.env.PLACEHOLDER_TEST = "change-me-to-a-random-32-char-string";
      expect(isEnvConfigured("PLACEHOLDER_TEST")).toBe(false);
      delete process.env.PLACEHOLDER_TEST;
    });

    it("returns false for empty strings", () => {
      process.env.EMPTY_TEST = "";
      expect(isEnvConfigured("EMPTY_TEST")).toBe(false);
      delete process.env.EMPTY_TEST;
    });

    it("returns true for a real value", () => {
      process.env.REAL_TEST = "realvalue";
      expect(isEnvConfigured("REAL_TEST")).toBe(true);
      delete process.env.REAL_TEST;
    });
  });
});
