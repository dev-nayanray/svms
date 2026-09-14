/**
 * Centralized RBAC — single source of truth for which role can do what.
 * Every permission check must go through here, never scatter role string
 * comparisons across components or API routes.
 */

export const PERMISSIONS = {
  // Students
  "students.read": ["ADMIN", "EMPLOYEE"],
  "students.create": ["ADMIN", "EMPLOYEE"],
  "students.update": ["ADMIN", "EMPLOYEE"],
  "students.delete": ["ADMIN"],
  // Employees
  "employees.read": ["ADMIN"],
  "employees.manage": ["ADMIN"],
  // Leads
  "leads.read": ["ADMIN", "EMPLOYEE"],
  "leads.manage": ["ADMIN", "EMPLOYEE"],
  // Applications
  "applications.read": ["ADMIN", "EMPLOYEE"],
  "applications.update": ["ADMIN", "EMPLOYEE"],
  // Catalog
  "universities.read": ["ADMIN", "EMPLOYEE"],
  "universities.manage": ["ADMIN"],
  "courses.read": ["ADMIN", "EMPLOYEE"],
  "courses.manage": ["ADMIN"],
  "countries.read": ["ADMIN", "EMPLOYEE"],
  // Documents
  "documents.read": ["ADMIN", "EMPLOYEE"],
  "documents.review": ["ADMIN", "EMPLOYEE"],
  // Tasks
  "tasks.read": ["ADMIN", "EMPLOYEE"],
  "tasks.manage": ["ADMIN", "EMPLOYEE"],
  // Appointments (separated from tasks for future role differentiation)
  "appointments.read": ["ADMIN", "EMPLOYEE"],
  "appointments.manage": ["ADMIN", "EMPLOYEE"],
  // Visa
  "visa.read": ["ADMIN", "EMPLOYEE"],
  "visa.manage": ["ADMIN", "EMPLOYEE"],
  // Finance
  "payments.read": ["ADMIN", "EMPLOYEE"],
  "payments.manage": ["ADMIN", "EMPLOYEE"], // create / record / cancel
  "payments.refund": ["ADMIN", "EMPLOYEE"], // refund (separation of duties)
  "invoices.read": ["ADMIN", "EMPLOYEE"],
  "invoices.manage": ["ADMIN", "EMPLOYEE"], // create / issue / cancel
  // Messaging
  "messages.read": ["ADMIN", "EMPLOYEE"],
  "messages.create": ["ADMIN", "EMPLOYEE"],
  // Reports
  "reports.read": ["ADMIN", "EMPLOYEE"],
  // Audit
  "audit.read": ["ADMIN"],
  // System
  "settings.manage": ["ADMIN"],
} as const satisfies Record<string, readonly string[]>;

export type PermissionKey = keyof typeof PERMISSIONS;
export type RoleName = "ADMIN" | "EMPLOYEE" | "STUDENT";

export function hasPermission(
  role: string | undefined | null,
  permission: PermissionKey,
): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export function assertPermission(role: string | undefined | null, permission: PermissionKey): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionError(`Missing permission: ${permission}`);
  }
}

export const ROLE_HOME: Record<RoleName, string> = {
  ADMIN: "/admin",
  EMPLOYEE: "/employee",
  STUDENT: "/student",
};

/** All permission keys grouped by domain — powers the permission-aware sidebar. */
export const PERMISSION_GROUPS: { label: string; permissions: PermissionKey[] }[] = [
  { label: "Students", permissions: ["students.read", "students.create", "students.update"] },
  { label: "Leads", permissions: ["leads.read", "leads.manage"] },
  { label: "Applications", permissions: ["applications.read", "applications.update"] },
  { label: "Catalog", permissions: ["universities.read", "courses.read", "countries.read"] },
  { label: "Documents", permissions: ["documents.read", "documents.review"] },
  { label: "Visa", permissions: ["visa.read", "visa.manage"] },
  { label: "Tasks", permissions: ["tasks.read", "tasks.manage"] },
  { label: "Appointments", permissions: ["appointments.read", "appointments.manage"] },
  { label: "Finance", permissions: ["payments.read", "payments.manage", "payments.refund", "invoices.read", "invoices.manage"] },
  { label: "Messaging", permissions: ["messages.read", "messages.create"] },
  { label: "Reports", permissions: ["reports.read"] },
];
