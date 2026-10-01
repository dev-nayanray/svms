import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  hasPermission,
  assertPermission,
  PermissionError,
  ROLE_HOME,
  PERMISSION_GROUPS,
  type PermissionKey,
} from "@/lib/permissions";

describe("RBAC: permission map", () => {
  it("includes all expected permission keys for the three roles", () => {
    // Critical permissions must exist in the map.
    const required: PermissionKey[] = [
      "students.read",
      "students.create",
      "students.update",
      "leads.read",
      "leads.manage",
      "applications.read",
      "applications.update",
      "documents.read",
      "documents.review",
      "tasks.read",
      "tasks.manage",
      "visa.read",
      "payments.read",
      "invoices.read",
      "messages.read",
      "messages.create",
      "reports.read",
      "audit.read",
      "settings.manage",
    ];
    for (const k of required) {
      expect(PERMISSIONS).toHaveProperty(k);
    }
  });

  it("EMPLOYEE has read access to most domains but never admin-only operations", () => {
    // Read access
    expect(hasPermission("EMPLOYEE", "students.read")).toBe(true);
    expect(hasPermission("EMPLOYEE", "applications.read")).toBe(true);
    expect(hasPermission("EMPLOYEE", "documents.review")).toBe(true);
    expect(hasPermission("EMPLOYEE", "reports.read")).toBe(true);

    // Admin-only — EMPLOYEE must NEVER have these
    expect(hasPermission("EMPLOYEE", "employees.read")).toBe(false);
    expect(hasPermission("EMPLOYEE", "employees.manage")).toBe(false);
    expect(hasPermission("EMPLOYEE", "audit.read")).toBe(false);
    expect(hasPermission("EMPLOYEE", "settings.manage")).toBe(false);
    expect(hasPermission("EMPLOYEE", "universities.manage")).toBe(false);
    expect(hasPermission("EMPLOYEE", "courses.manage")).toBe(false);
    expect(hasPermission("EMPLOYEE", "students.delete")).toBe(false);
  });

  it("ADMIN has every permission in the map", () => {
    for (const key of Object.keys(PERMISSIONS) as PermissionKey[]) {
      expect(hasPermission("ADMIN", key)).toBe(true);
    }
  });

  it("STUDENT has no employee or admin permissions", () => {
    // The /employee panel is for EMPLOYEE + ADMIN only — STUDENT must be
    // blocked at every permission the sidebar declares.
    const studentPerms: PermissionKey[] = [
      "students.read",
      "leads.read",
      "applications.read",
      "documents.read",
      "documents.review",
      "tasks.read",
      "payments.read",
      "invoices.read",
      "messages.read",
      "reports.read",
    ];
    for (const p of studentPerms) {
      expect(hasPermission("STUDENT", p)).toBe(false);
    }
  });

  it("hasPermission returns false for null / undefined / unknown roles", () => {
    expect(hasPermission(null, "students.read")).toBe(false);
    expect(hasPermission(undefined, "students.read")).toBe(false);
    expect(hasPermission("UNKNOWN_ROLE", "students.read")).toBe(false);
    expect(hasPermission("", "students.read")).toBe(false);
  });
});

describe("RBAC: assertPermission throws PermissionError", () => {
  it("does not throw when the role has the permission", () => {
    expect(() => assertPermission("ADMIN", "students.read")).not.toThrow();
    expect(() => assertPermission("EMPLOYEE", "students.read")).not.toThrow();
  });

  it("throws PermissionError when the role lacks the permission", () => {
    expect(() => assertPermission("STUDENT", "students.read")).toThrow(PermissionError);
    expect(() => assertPermission("EMPLOYEE", "audit.read")).toThrow(PermissionError);
    expect(() => assertPermission(null, "students.read")).toThrow(PermissionError);
  });
});

describe("RBAC: role home routing", () => {
  it("keeps each role inside its own panel prefix", () => {
    expect(ROLE_HOME.ADMIN).toBe("/admin");
    expect(ROLE_HOME.EMPLOYEE).toBe("/employee");
    expect(ROLE_HOME.STUDENT).toBe("/student");
  });
});

describe("RBAC: permission groups for sidebar filtering", () => {
  it("groups every permission into a labeled bucket so the sidebar can filter", () => {
    expect(PERMISSION_GROUPS.length).toBeGreaterThan(0);
    for (const g of PERMISSION_GROUPS) {
      expect(g.label).toBeTruthy();
      expect(g.permissions.length).toBeGreaterThan(0);
      for (const p of g.permissions) {
        expect(PERMISSIONS).toHaveProperty(p);
      }
    }
  });

  it("covers the keys used by the employee sidebar config", () => {
    // Sidebar-referenced permission keys must all exist in the map.
    const sidebarKeys = [
      "students.read",
      "leads.read",
      "applications.read",
      "universities.read",
      "courses.read",
      "documents.read",
      "visa.read",
      "tasks.read",
      "messages.read",
      "payments.read",
      "invoices.read",
      "reports.read",
    ] as PermissionKey[];
    const all = new Set<PermissionKey>();
    PERMISSION_GROUPS.forEach((g) => g.permissions.forEach((p) => all.add(p)));
    for (const k of sidebarKeys) {
      expect(all.has(k)).toBe(true);
    }
  });
});
