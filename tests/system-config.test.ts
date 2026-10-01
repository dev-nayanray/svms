import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

// Mock prisma — the tests don't need a real database.
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    systemSetting: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
  return { prisma: mockPrisma as unknown as PrismaClient };
});

import { getConfig, setConfig, getBackupConfig, getSeoConfig } from "@/lib/system/config";
import { __clearConfigCacheForTests } from "@/lib/system/config";

describe("System Configuration", () => {
  beforeEach(() => {
    __clearConfigCacheForTests();
  });

  describe("getConfig", () => {
    it("returns the default value when no DB row exists", async () => {
      const provider = await getConfig("backup.provider");
      expect(provider).toBe("local");
    });

    it("returns boolean defaults correctly", async () => {
      const encrypted = await getConfig("backup.encryption");
      expect(encrypted).toBe(true);
    });

    it("returns numeric defaults correctly", async () => {
      const retention = await getConfig("backup.retentionDaily");
      expect(retention).toBe(7);
    });

    it("returns undefined for unknown keys", async () => {
      const v = await getConfig("nonexistent.key");
      expect(v).toBeUndefined();
    });
  });

  describe("setConfig", () => {
    it("refuses to persist keys that look like secrets", async () => {
      await expect(
        setConfig("auth.secret", "supersecretvalue", "user-1"),
      ).rejects.toThrow(/secret/i);
    });

    it("refuses to persist keys matching password pattern", async () => {
      await expect(
        setConfig("smtp.password", "p@ssw0rd", "user-1"),
      ).rejects.toThrow(/secret/i);
    });

    it("refuses to persist keys matching token pattern", async () => {
      await expect(
        setConfig("api.token", "tok_xxx", "user-1"),
      ).rejects.toThrow(/secret/i);
    });
  });

  describe("getBackupConfig", () => {
    it("returns the full backup config with defaults", async () => {
      const cfg = await getBackupConfig();
      expect(cfg.provider).toBe("local");
      expect(cfg.encryption).toBe(true);
      expect(cfg.retentionDaily).toBe(7);
      expect(cfg.retentionWeekly).toBe(4);
      expect(cfg.retentionMonthly).toBe(12);
      expect(cfg.maxCount).toBe(50);
      expect(cfg.autoEnabled).toBe(false);
      expect(cfg.defaultScope).toEqual(["*"]);
    });
  });

  describe("getSeoConfig", () => {
    it("returns the SEO config with defaults", async () => {
      const cfg = await getSeoConfig();
      expect(cfg.siteName).toBe("Euroscope");
      expect(cfg.locale).toBe("en_US");
      expect(cfg.language).toBe("en");
      expect(cfg.indexPrivateRoutes).toBe(false);
    });

    it("canonicalBase falls back to NEXT_PUBLIC_APP_URL when not configured", async () => {
      const cfg = await getSeoConfig();
      // Will be whatever the env var is — just verify it's a string.
      expect(typeof cfg.canonicalBase).toBe("string");
      expect(cfg.canonicalBase.length).toBeGreaterThan(0);
    });
  });
});
