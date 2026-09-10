import { describe, it, expect } from "vitest";
import { hasPermission, assertPermission, PermissionError, PERMISSIONS } from "@/lib/permissions";

describe("RBAC permission map", () => {
  it("grants dashboard read to admin only", () => {
    expect(hasPermission("ADMIN", "dashboard.read")).toBe(true);
    expect(hasPermission("EMPLOYEE", "dashboard.read")).toBe(false);
    expect(hasPermission("STUDENT", "dashboard.read")).toBe(false);
  });

  it("keeps finance restricted to admin", () => {
    expect(hasPermission("ADMIN", "finance.read")).toBe(true);
    expect(hasPermission("EMPLOYEE", "finance.read")).toBe(false);
  });

  it("lets employees read students but not delete them", () => {
    expect(hasPermission("EMPLOYEE", "students.read")).toBe(true);
    expect(hasPermission("EMPLOYEE", "students.delete")).toBe(false);
  });

  it("gives students document upload but not review", () => {
    expect(hasPermission("STUDENT", "documents.upload")).toBe(true);
    expect(hasPermission("STUDENT", "documents.review")).toBe(false);
  });

  it("denies everything for missing or unknown roles", () => {
    expect(hasPermission(undefined, "students.read")).toBe(false);
    expect(hasPermission(null, "students.read")).toBe(false);
    expect(hasPermission("SUPERADMIN", "students.read")).toBe(false);
  });

  it("assertPermission throws PermissionError for denied access", () => {
    expect(() => assertPermission("STUDENT", "settings.manage")).toThrow(PermissionError);
    expect(() => assertPermission("ADMIN", "settings.manage")).not.toThrow();
  });

  it("every permission declares at least one role and only known roles", () => {
    const known = new Set(["ADMIN", "EMPLOYEE", "STUDENT"]);
    for (const roles of Object.values(PERMISSIONS)) {
      expect(roles.length).toBeGreaterThan(0);
      for (const r of roles) expect(known.has(r)).toBe(true);
    }
  });
});
