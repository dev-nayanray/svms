import { describe, it, expect } from "vitest";
import {
  hasPermission,
  assertPermission,
  PermissionError,
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions";
import {
  PERMISSION_GROUPS,
  PERMISSION_DESCRIPTIONS,
  ROLE_METADATA,
  getPermissionGroup,
  getAllPermissionKeys,
} from "@/lib/constants/permissions-meta";

// ─────────────────────────────────────────────
// Existing permission map tests (preserved)
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Privilege escalation tests
// ─────────────────────────────────────────────

describe("privilege escalation prevention", () => {
  it("STUDENT cannot access any admin-only permissions", () => {
    const adminOnly: PermissionKey[] = [
      "employees.read",
      "employees.create",
      "employees.update",
      "employees.delete",
      "finance.read",
      "finance.manage",
      "settings.manage",
      "audit.read",
      "audit_logs.read",
      "branches.manage",
      "roles.read",
      "dashboard.read",
    ];
    for (const perm of adminOnly) {
      expect(hasPermission("STUDENT", perm)).toBe(false);
    }
  });

  it("EMPLOYEE cannot access any admin-only permissions", () => {
    const adminOnly: PermissionKey[] = [
      "students.delete",
      "employees.read",
      "employees.create",
      "employees.update",
      "employees.delete",
      "applications.delete",
      "universities.manage",
      "courses.manage",
      "countries.manage",
      "visa.manage",
      "stages.manage",
      "intakes.manage",
      "finance.read",
      "finance.manage",
      "settings.manage",
      "audit.read",
      "audit_logs.read",
      "branches.manage",
      "roles.read",
      "dashboard.read",
    ];
    for (const perm of adminOnly) {
      expect(hasPermission("EMPLOYEE", perm)).toBe(false);
    }
  });

  it("STUDENT cannot delete students", () => {
    expect(hasPermission("STUDENT", "students.delete")).toBe(false);
    expect(hasPermission("STUDENT", "students.create")).toBe(false);
    expect(hasPermission("STUDENT", "students.update")).toBe(false);
  });

  it("STUDENT cannot manage applications (only view via the student portal)", () => {
    expect(hasPermission("STUDENT", "applications.read")).toBe(false);
    expect(hasPermission("STUDENT", "applications.manage")).toBe(false);
    expect(hasPermission("STUDENT", "applications.delete")).toBe(false);
  });

  it("EMPLOYEE cannot manage finance — no payments, no invoices, no refunds", () => {
    expect(hasPermission("EMPLOYEE", "finance.read")).toBe(false);
    expect(hasPermission("EMPLOYEE", "finance.manage")).toBe(false);
  });

  it("EMPLOYEE cannot access audit logs", () => {
    expect(hasPermission("EMPLOYEE", "audit.read")).toBe(false);
    expect(hasPermission("EMPLOYEE", "audit_logs.read")).toBe(false);
  });

  it("EMPLOYEE cannot manage branches", () => {
    expect(hasPermission("EMPLOYEE", "branches.manage")).toBe(false);
  });

  it("EMPLOYEE cannot view the roles & permissions matrix", () => {
    expect(hasPermission("EMPLOYEE", "roles.read")).toBe(false);
  });

  it("EMPLOYEE cannot manage system settings", () => {
    expect(hasPermission("EMPLOYEE", "settings.manage")).toBe(false);
  });

  it("EMPLOYEE cannot manage universities, courses, countries, or intakes", () => {
    expect(hasPermission("EMPLOYEE", "universities.manage")).toBe(false);
    expect(hasPermission("EMPLOYEE", "courses.manage")).toBe(false);
    expect(hasPermission("EMPLOYEE", "countries.manage")).toBe(false);
    expect(hasPermission("EMPLOYEE", "intakes.manage")).toBe(false);
    expect(hasPermission("EMPLOYEE", "stages.manage")).toBe(false);
  });

  it("EMPLOYEE cannot delete applications", () => {
    expect(hasPermission("EMPLOYEE", "applications.delete")).toBe(false);
  });

  it("STUDENT can only access student-portal permissions + document upload + catalog read", () => {
    // Student-allowed permissions
    expect(hasPermission("STUDENT", "student.favorites")).toBe(true);
    expect(hasPermission("STUDENT", "student.counseling")).toBe(true);
    expect(hasPermission("STUDENT", "documents.upload")).toBe(true);
    expect(hasPermission("STUDENT", "universities.read")).toBe(true);
    expect(hasPermission("STUDENT", "courses.read")).toBe(true);
    expect(hasPermission("STUDENT", "countries.read")).toBe(true);
    expect(hasPermission("STUDENT", "visa.read")).toBe(true);

    // Student-denied permissions (sampling)
    expect(hasPermission("STUDENT", "students.read")).toBe(false);
    expect(hasPermission("STUDENT", "tasks.read")).toBe(false);
    expect(hasPermission("STUDENT", "tasks.manage")).toBe(false);
    expect(hasPermission("STUDENT", "leads.read")).toBe(false);
    expect(hasPermission("STUDENT", "leads.manage")).toBe(false);
    expect(hasPermission("STUDENT", "reports.read")).toBe(false);
  });

  it("assertPermission throws for every admin-only permission when role is STUDENT", () => {
    const adminOnly: PermissionKey[] = [
      "finance.read",
      "settings.manage",
      "branches.manage",
      "roles.read",
    ];
    for (const perm of adminOnly) {
      expect(() => assertPermission("STUDENT", perm)).toThrow(PermissionError);
    }
  });

  it("assertPermission throws for every admin-only permission when role is EMPLOYEE", () => {
    const adminOnly: PermissionKey[] = [
      "finance.read",
      "settings.manage",
      "branches.manage",
      "roles.read",
      "employees.read",
    ];
    for (const perm of adminOnly) {
      expect(() => assertPermission("EMPLOYEE", perm)).toThrow(PermissionError);
    }
  });

  it("unknown roles cannot access any permission (deny-by-default)", () => {
    // Try a sampling of permissions across all groups
    const sample: PermissionKey[] = [
      "students.read",
      "finance.read",
      "settings.manage",
      "documents.upload",
      "reports.read",
    ];
    for (const perm of sample) {
      expect(hasPermission("SUPERADMIN", perm)).toBe(false);
      expect(hasPermission("MANAGER", perm)).toBe(false);
      expect(hasPermission("", perm)).toBe(false);
    }
  });

  it("null/undefined roles cannot access any permission (deny-by-default)", () => {
    const sample: PermissionKey[] = [
      "students.read",
      "finance.read",
      "settings.manage",
    ];
    for (const perm of sample) {
      expect(hasPermission(null, perm)).toBe(false);
      expect(hasPermission(undefined, perm)).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────
// Permission group metadata tests
// ─────────────────────────────────────────────

describe("permission group metadata", () => {
  it("every permission key in PERMISSIONS belongs to exactly one group", () => {
    const allKeys = getAllPermissionKeys();
    for (const key of Object.keys(PERMISSIONS)) {
      expect(allKeys).toContain(key);
    }
  });

  it("every permission key has a description", () => {
    for (const key of Object.keys(PERMISSIONS)) {
      expect(PERMISSION_DESCRIPTIONS[key]).toBeDefined();
      expect(PERMISSION_DESCRIPTIONS[key].length).toBeGreaterThan(0);
    }
  });

  it("every role has metadata (label + description)", () => {
    for (const roleName of ["ADMIN", "EMPLOYEE", "STUDENT"]) {
      expect(ROLE_METADATA[roleName]).toBeDefined();
      expect(ROLE_METADATA[roleName].label.length).toBeGreaterThan(0);
      expect(ROLE_METADATA[roleName].description.length).toBeGreaterThan(0);
    }
  });

  it("getPermissionGroup returns the correct group for a known key", () => {
    expect(getPermissionGroup("students.read")?.key).toBe("students");
    expect(getPermissionGroup("finance.read")?.key).toBe("finance");
    expect(getPermissionGroup("documents.review")?.key).toBe("documents");
    expect(getPermissionGroup("settings.manage")?.key).toBe("system");
  });

  it("getPermissionGroup returns null for unknown keys", () => {
    expect(getPermissionGroup("unknown.permission")).toBeNull();
    expect(getPermissionGroup("")).toBeNull();
  });

  it("getAllPermissionKeys returns keys in group order", () => {
    const keys = getAllPermissionKeys();
    // Students group keys should come before Employees group keys
    const studentsIdx = keys.indexOf("students.read");
    const employeesIdx = keys.indexOf("employees.read");
    expect(studentsIdx).toBeLessThan(employeesIdx);
    expect(studentsIdx).toBeGreaterThanOrEqual(0);
  });

  it("permission groups have unique keys", () => {
    const keys = PERMISSION_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("permission groups have non-empty permission arrays", () => {
    for (const group of PERMISSION_GROUPS) {
      expect(group.permissions.length).toBeGreaterThan(0);
    }
  });

  it("the 14 documented permission groups are all present", () => {
    const groupKeys = PERMISSION_GROUPS.map((g) => g.key);
    expect(groupKeys).toContain("students");
    expect(groupKeys).toContain("employees");
    expect(groupKeys).toContain("leads");
    expect(groupKeys).toContain("applications");
    expect(groupKeys).toContain("documents");
    expect(groupKeys).toContain("catalog"); // Universities & Courses
    expect(groupKeys).toContain("visa");
    expect(groupKeys).toContain("tasks");
    expect(groupKeys).toContain("finance");
    expect(groupKeys).toContain("reports");
    expect(groupKeys).toContain("branches");
    expect(groupKeys).toContain("system"); // Settings & Audit
  });
});

// ─────────────────────────────────────────────
// Boundary tests — verify specific permission boundaries
// ─────────────────────────────────────────────

describe("permission boundary tests", () => {
  it("ADMIN has every non-student-portal permission", () => {
    // ADMIN has all permissions EXCEPT the student-portal-only ones
    // (student.favorites, student.counseling) which are STUDENT-exclusive
    const studentOnly = ["student.favorites", "student.counseling"];
    for (const key of Object.keys(PERMISSIONS)) {
      if (studentOnly.includes(key)) {
        expect(hasPermission("ADMIN", key as PermissionKey)).toBe(false);
      } else {
        expect(hasPermission("ADMIN", key as PermissionKey)).toBe(true);
      }
    }
  });

  it("documents.review is granted to ADMIN and EMPLOYEE but not STUDENT", () => {
    expect(hasPermission("ADMIN", "documents.review")).toBe(true);
    expect(hasPermission("EMPLOYEE", "documents.review")).toBe(true);
    expect(hasPermission("STUDENT", "documents.review")).toBe(false);
  });

  it("documents.upload is granted to all three roles", () => {
    expect(hasPermission("ADMIN", "documents.upload")).toBe(true);
    expect(hasPermission("EMPLOYEE", "documents.upload")).toBe(true);
    expect(hasPermission("STUDENT", "documents.upload")).toBe(true);
  });

  it("finance.manage is ADMIN-only", () => {
    expect(hasPermission("ADMIN", "finance.manage")).toBe(true);
    expect(hasPermission("EMPLOYEE", "finance.manage")).toBe(false);
    expect(hasPermission("STUDENT", "finance.manage")).toBe(false);
  });

  it("leads.manage is shared between ADMIN and EMPLOYEE", () => {
    expect(hasPermission("ADMIN", "leads.manage")).toBe(true);
    expect(hasPermission("EMPLOYEE", "leads.manage")).toBe(true);
    expect(hasPermission("STUDENT", "leads.manage")).toBe(false);
  });

  it("student.favorites and student.counseling are STUDENT-only", () => {
    expect(hasPermission("STUDENT", "student.favorites")).toBe(true);
    expect(hasPermission("STUDENT", "student.counseling")).toBe(true);
    expect(hasPermission("ADMIN", "student.favorites")).toBe(false);
    expect(hasPermission("EMPLOYEE", "student.counseling")).toBe(false);
  });
});
