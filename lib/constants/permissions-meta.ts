/**
 * Permission group metadata for the Roles & Permissions admin UI.
 *
 * The actual permission map lives in `lib/permissions/index.ts` — this
 * file provides the human-readable grouping, labels, and descriptions
 * so the admin can understand what each permission does without reading
 * code.
 *
 * Security note: the permission map is intentionally a static code
 * constant. Changing which roles have which permissions is a
 * security-sensitive operation that requires a code change + code
 * review + redeploy. The admin UI is read-only by design — it displays
 * the matrix but does not allow runtime modification. This prevents
 * privilege escalation via the database.
 */

export type PermissionGroup = {
  /** Group key — used for sorting + CSS. */
  key: string;
  /** Human-readable group label. */
  label: string;
  /** Icon name (lucide-react) for the group header. */
  icon: string;
  /** Permission keys that belong to this group. */
  permissions: string[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "students",
    label: "Students",
    icon: "Users",
    permissions: ["students.read", "students.create", "students.update", "students.delete"],
  },
  {
    key: "employees",
    label: "Employees",
    icon: "GraduationCap",
    permissions: ["employees.read", "employees.create", "employees.update", "employees.delete"],
  },
  {
    key: "leads",
    label: "Leads",
    icon: "Target",
    permissions: ["leads.read", "leads.manage"],
  },
  {
    key: "applications",
    label: "Applications",
    icon: "FolderKanban",
    permissions: ["applications.read", "applications.manage", "applications.delete"],
  },
  {
    key: "documents",
    label: "Documents",
    icon: "FileText",
    permissions: ["documents.read", "documents.upload", "documents.review"],
  },
  {
    key: "catalog",
    label: "Universities & Courses",
    icon: "Building2",
    permissions: [
      "universities.read", "universities.manage",
      "courses.read", "courses.manage",
      "countries.read", "countries.manage",
      "stages.manage", "intakes.manage",
    ],
  },
  {
    key: "visa",
    label: "Visa",
    icon: "Stamp",
    permissions: ["visa.read", "visa.manage"],
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: "CheckSquare",
    permissions: ["tasks.read", "tasks.manage", "notes.internal"],
  },
  {
    key: "finance",
    label: "Finance",
    icon: "CreditCard",
    permissions: ["finance.read", "finance.manage"],
  },
  {
    key: "reports",
    label: "Reports",
    icon: "BarChart3",
    permissions: ["reports.read"],
  },
  {
    key: "branches",
    label: "Branches",
    icon: "GitBranch",
    permissions: ["branches.manage"],
  },
  {
    key: "student-portal",
    label: "Student Portal",
    icon: "Globe",
    permissions: ["student.favorites", "student.counseling"],
  },
  {
    key: "system",
    label: "Settings & Audit",
    icon: "Settings",
    permissions: ["settings.manage", "audit.read", "audit_logs.read", "roles.read", "dashboard.read", "search.read"],
  },
];

/** Human-readable description for each permission key. */
export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  "students.read": "View student profiles and lists",
  "students.create": "Create new student profiles",
  "students.update": "Edit student information",
  "students.delete": "Archive/soft-delete students",
  "employees.read": "View employee profiles and performance",
  "employees.create": "Create new employee accounts",
  "employees.update": "Edit employee info and assign roles",
  "employees.delete": "Archive/soft-delete employees",
  "leads.read": "View leads and the CRM pipeline",
  "leads.manage": "Create, edit, convert, and archive leads",
  "applications.read": "View applications and their details",
  "applications.manage": "Create, edit, assign, and change stages",
  "applications.delete": "Archive/soft-delete applications",
  "documents.read": "View student documents",
  "documents.upload": "Upload documents on behalf of students",
  "documents.review": "Approve, reject, and request re-uploads",
  "universities.read": "View the university catalog",
  "universities.manage": "Create, edit, and archive universities",
  "courses.read": "View the course catalog",
  "courses.manage": "Create, edit, and archive courses",
  "countries.read": "View the country catalog",
  "countries.manage": "Create, edit, and archive countries",
  "stages.manage": "Configure the application pipeline stages",
  "intakes.manage": "Create, edit, and archive intakes",
  "visa.read": "View visa applications and requirements",
  "visa.manage": "Change visa stages and configure requirements",
  "tasks.read": "View tasks across the team",
  "tasks.manage": "Create, assign, edit, complete, and archive tasks",
  "notes.internal": "View and add internal (non-student-visible) notes",
  "finance.read": "View payments, invoices, and financial reports",
  "finance.manage": "Record payments, create invoices, process refunds",
  "reports.read": "View analytics and export reports",
  "branches.manage": "Create, edit, and archive branches",
  "student.favorites": "Save/unsave universities (student portal)",
  "student.counseling": "Request counseling for universities/courses",
  "settings.manage": "Configure system settings",
  "audit.read": "View the audit log",
  "audit_logs.read": "View the audit log (alias)",
  "roles.read": "View roles and the permission matrix",
  "dashboard.read": "View the admin dashboard",
  "search.read": "Use the global search",
};

/** Role labels + descriptions for the role list. */
export const ROLE_METADATA: Record<string, { label: string; description: string }> = {
  ADMIN: {
    label: "Administrator",
    description: "Full system access — all modules, all permissions, all data.",
  },
  EMPLOYEE: {
    label: "Counselor / Employee",
    description: "Operational access — students, leads, applications, documents, tasks. No admin/system settings.",
  },
  STUDENT: {
    label: "Student",
    description: "Self-service portal — browse universities/courses, upload documents, view applications.",
  },
};

/**
 * Returns the permission group that a given permission key belongs to.
 * Returns null for unknown keys.
 */
export function getPermissionGroup(key: string): PermissionGroup | null {
  for (const group of PERMISSION_GROUPS) {
    if (group.permissions.includes(key)) return group;
  }
  return null;
}

/**
 * Returns all permission keys across all groups, in group order.
 */
export function getAllPermissionKeys(): string[] {
  return PERMISSION_GROUPS.flatMap((g) => g.permissions);
}
