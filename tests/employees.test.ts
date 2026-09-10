import { describe, it, expect } from "vitest";
import {
  computeTaskStats,
  roleAssignmentError,
  generateTempPassword,
} from "@/lib/utils/employee-insights";
import { employeeUpdateSchema } from "@/lib/validations";

const ADMIN = { id: "admin-user" };

describe("computeTaskStats", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const past = "2026-09-01";
  const future = "2026-09-20";

  it("ignores completed and cancelled tasks", () => {
    const stats = computeTaskStats(
      [
        { status: "COMPLETED", dueDate: past },
        { status: "CANCELLED", dueDate: past },
        { status: "TODO", dueDate: future },
      ],
      now
    );
    expect(stats).toEqual({ pending: 1, overdue: 0 });
  });

  it("counts open tasks and flags overdue ones", () => {
    const stats = computeTaskStats(
      [
        { status: "TODO", dueDate: past },
        { status: "IN_PROGRESS", dueDate: future },
        { status: "TODO", dueDate: null },
      ],
      now
    );
    expect(stats.pending).toBe(3);
    expect(stats.overdue).toBe(1);
  });

  it("returns zeros for an empty list", () => {
    expect(computeTaskStats([], now)).toEqual({ pending: 0, overdue: 0 });
  });
});

describe("roleAssignmentError (RBAC guard)", () => {
  const employee = { userId: "emp-1", roleName: "EMPLOYEE" };

  it("allows valid staff role changes", () => {
    expect(roleAssignmentError(employee, ADMIN, "ADMIN")).toBeNull();
    expect(roleAssignmentError({ userId: "emp-2", roleName: "ADMIN" }, ADMIN, "EMPLOYEE")).toBeNull();
  });

  it("blocks unknown or student roles", () => {
    expect(roleAssignmentError(employee, ADMIN, "SUPERADMIN")).toMatch(/Role must be/i);
    expect(roleAssignmentError(employee, ADMIN, "STUDENT")).toMatch(/Role must be/i);
    expect(roleAssignmentError({ userId: "s", roleName: "STUDENT" }, ADMIN, "ADMIN")).toMatch(
      /cannot be assigned staff roles/i
    );
  });

  it("blocks changing your own role (lock-out protection)", () => {
    expect(roleAssignmentError({ userId: "me", roleName: "ADMIN" }, { id: "me" }, "EMPLOYEE")).toMatch(
      /own role/i
    );
  });
});

describe("generateTempPassword (reset access)", () => {
  it("meets length and policy requirements", () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateTempPassword();
      expect(pw).toHaveLength(12);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[A-Za-z]/);
    }
  });

  it("uses an unambiguous character set", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTempPassword()).not.toMatch(/[OIl0o1]/);
    }
  });

  it("honours custom lengths while staying valid", () => {
    const pw = generateTempPassword(16);
    expect(pw).toHaveLength(16);
    expect(pw).toMatch(/[0-9]/);
  });
});

describe("employee update schema", () => {
  it("accepts role and status assignments", () => {
    expect(employeeUpdateSchema.safeParse({ roleName: "ADMIN" }).success).toBe(true);
    expect(employeeUpdateSchema.safeParse({ status: "INACTIVE" }).success).toBe(true);
  });

  it("rejects invalid roles and statuses", () => {
    expect(employeeUpdateSchema.safeParse({ roleName: "STUDENT" }).success).toBe(false);
    expect(employeeUpdateSchema.safeParse({ status: "BANNED" }).success).toBe(false);
  });
});
