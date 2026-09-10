/**
 * Centralized RBAC. All permission checks must go through here —
 * never scatter role string comparisons across components.
 */

export const PERMISSIONS = {
  // Students
  "students.read": ["ADMIN", "EMPLOYEE"],
  "students.create": ["ADMIN", "EMPLOYEE"],
  "students.update": ["ADMIN", "EMPLOYEE"],
  "students.delete": ["ADMIN"],
  // Employees
  "employees.read": ["ADMIN"],
  "employees.create": ["ADMIN"],
  "employees.update": ["ADMIN"],
  "employees.delete": ["ADMIN"],
  // Leads
  "leads.read": ["ADMIN", "EMPLOYEE"],
  "leads.manage": ["ADMIN", "EMPLOYEE"],
  // Applications
  "applications.read": ["ADMIN", "EMPLOYEE"],
  "applications.manage": ["ADMIN", "EMPLOYEE"],
  "applications.delete": ["ADMIN"],
  // Catalog
  "universities.read": ["ADMIN", "EMPLOYEE"],
  "universities.manage": ["ADMIN"],
  "courses.read": ["ADMIN", "EMPLOYEE"],
  "courses.manage": ["ADMIN"],
  "countries.read": ["ADMIN", "EMPLOYEE"],
  "countries.manage": ["ADMIN"],
  "visa.read": ["ADMIN", "EMPLOYEE"],
  "visa.manage": ["ADMIN"],
  "stages.manage": ["ADMIN"],
  // Documents
  "documents.read": ["ADMIN", "EMPLOYEE"],
  "documents.upload": ["ADMIN", "EMPLOYEE", "STUDENT"],
  "documents.review": ["ADMIN", "EMPLOYEE"],
  // Tasks
  "tasks.read": ["ADMIN", "EMPLOYEE"],
  "tasks.manage": ["ADMIN", "EMPLOYEE"],
  // Notes
  "notes.internal": ["ADMIN", "EMPLOYEE"],
  // Finance
  "finance.read": ["ADMIN"],
  "finance.manage": ["ADMIN"],
  // Reports
  "reports.read": ["ADMIN", "EMPLOYEE"],
  // System
  "settings.manage": ["ADMIN"],
  "audit.read": ["ADMIN"],
  "audit_logs.read": ["ADMIN"],
  "branches.manage": ["ADMIN"],
  "roles.read": ["ADMIN"],
  "dashboard.read": ["ADMIN"],
  "search.read": ["ADMIN", "EMPLOYEE"],
  "intakes.manage": ["ADMIN"],
} as const satisfies Record<string, readonly string[]>;

export type PermissionKey = keyof typeof PERMISSIONS;
export type RoleName = "ADMIN" | "EMPLOYEE" | "STUDENT";

export function hasPermission(
  role: string | undefined | null,
  permission: PermissionKey
): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function assertPermission(role: string | undefined | null, permission: PermissionKey): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionError(`Missing permission: ${permission}`);
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export const ROLE_HOME: Record<RoleName, string> = {
  ADMIN: "/admin",
  EMPLOYEE: "/employee",
  STUDENT: "/student",
};
