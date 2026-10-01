import { describe, it, expect } from "vitest";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

describe("System Administration RBAC", () => {
  describe("Backup permissions", () => {
    it("ADMIN can create backups", () => {
      expect(hasPermission("ADMIN", "backup.create")).toBe(true);
    });

    it("ADMIN can restore backups", () => {
      expect(hasPermission("ADMIN", "backup.restore")).toBe(true);
    });

    it("ADMIN can delete backups", () => {
      expect(hasPermission("ADMIN", "backup.delete")).toBe(true);
    });

    it("ADMIN can read backups", () => {
      expect(hasPermission("ADMIN", "backup.read")).toBe(true);
    });

    it("EMPLOYEE cannot create backups", () => {
      expect(hasPermission("EMPLOYEE", "backup.create")).toBe(false);
    });

    it("STUDENT cannot create backups", () => {
      expect(hasPermission("STUDENT", "backup.create")).toBe(false);
    });

    it("EMPLOYEE cannot restore backups", () => {
      expect(hasPermission("EMPLOYEE", "backup.restore")).toBe(false);
    });
  });

  describe("Security permissions", () => {
    it("ADMIN can read security audit", () => {
      expect(hasPermission("ADMIN", "security.read")).toBe(true);
    });

    it("ADMIN can manage security", () => {
      expect(hasPermission("ADMIN", "security.manage")).toBe(true);
    });

    it("EMPLOYEE cannot read security", () => {
      expect(hasPermission("EMPLOYEE", "security.read")).toBe(false);
    });

    it("STUDENT cannot read security", () => {
      expect(hasPermission("STUDENT", "security.read")).toBe(false);
    });
  });

  describe("System permissions", () => {
    it("ADMIN can read system overview", () => {
      expect(hasPermission("ADMIN", "system.read")).toBe(true);
    });

    it("ADMIN can manage system", () => {
      expect(hasPermission("ADMIN", "system.manage")).toBe(true);
    });

    it("ADMIN can read system logs", () => {
      expect(hasPermission("ADMIN", "system.logs.read")).toBe(true);
    });

    it("EMPLOYEE cannot read system logs", () => {
      expect(hasPermission("EMPLOYEE", "system.logs.read")).toBe(false);
    });
  });

  describe("SEO + Analytics permissions", () => {
    it("ADMIN can manage SEO", () => {
      expect(hasPermission("ADMIN", "seo.manage")).toBe(true);
    });

    it("ADMIN can manage analytics", () => {
      expect(hasPermission("ADMIN", "analytics.manage")).toBe(true);
    });

    it("STUDENT cannot manage SEO", () => {
      expect(hasPermission("STUDENT", "seo.manage")).toBe(false);
    });

    it("EMPLOYEE cannot manage analytics", () => {
      expect(hasPermission("EMPLOYEE", "analytics.manage")).toBe(false);
    });
  });

  describe("Maintenance permissions", () => {
    it("ADMIN can manage maintenance", () => {
      expect(hasPermission("ADMIN", "maintenance.manage")).toBe(true);
    });

    it("EMPLOYEE cannot manage maintenance", () => {
      expect(hasPermission("EMPLOYEE", "maintenance.manage")).toBe(false);
    });
  });

  describe("Critical permission registration", () => {
    it("all critical permissions are registered", () => {
      const critical = [
        "backup.create",
        "backup.restore",
        "backup.delete",
        "backup.read",
        "security.read",
        "security.manage",
        "system.read",
        "system.manage",
        "system.logs.read",
        "seo.read",
        "seo.manage",
        "analytics.read",
        "analytics.manage",
        "maintenance.read",
        "maintenance.manage",
      ];
      for (const p of critical) {
        expect(PERMISSIONS).toHaveProperty(p);
      }
    });

    it("all critical permissions are ADMIN-only", () => {
      const critical: Array<keyof typeof PERMISSIONS> = [
        "backup.create",
        "backup.restore",
        "backup.delete",
        "security.manage",
        "system.manage",
        "seo.manage",
        "analytics.manage",
        "maintenance.manage",
      ];
      for (const p of critical) {
        const allowed = PERMISSIONS[p] as readonly string[];
        expect(allowed).toEqual(["ADMIN"]);
      }
    });
  });

  describe("Edge cases", () => {
    it("undefined role has no permissions", () => {
      expect(hasPermission(undefined, "system.read")).toBe(false);
    });

    it("null role has no permissions", () => {
      expect(hasPermission(null, "system.read")).toBe(false);
    });

    it("empty string role has no permissions", () => {
      expect(hasPermission("", "system.read")).toBe(false);
    });
  });
});
