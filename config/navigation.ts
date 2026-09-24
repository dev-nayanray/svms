import type { NavIconName } from "@/components/shared/nav-icons";

export type NavItem = { href: string; label: string; icon: NavIconName };
export type NavGroup = { label: string; items: NavItem[] };

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/admin/leads", label: "Leads", icon: "Target" },
      { href: "/admin/students", label: "Students", icon: "Users" },
      { href: "/admin/applications", label: "Applications", icon: "FolderKanban" },
    ],
  },
  {
    label: "Academic Catalog",
    items: [
      { href: "/admin/countries", label: "Countries", icon: "Globe" },
      { href: "/admin/universities", label: "Universities", icon: "Building2" },
      { href: "/admin/courses", label: "Courses", icon: "BookOpen" },
      { href: "/admin/intakes", label: "Intakes", icon: "CalendarClock" },
    ],
  },
  {
    label: "Documents & Visa",
    items: [
      { href: "/admin/documents", label: "Document Review", icon: "FileText" },
      { href: "/admin/visa", label: "Visa Management", icon: "Stamp" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/tasks", label: "Tasks", icon: "CheckSquare" },
      { href: "/admin/appointments", label: "Appointments", icon: "CalendarClock" },
      { href: "/admin/support", label: "Support Tickets", icon: "LifeBuoy" },
      { href: "/admin/messages", label: "Messages", icon: "MessageSquare" },
      { href: "/admin/notifications", label: "Notifications", icon: "Bell" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/payments", label: "Payments", icon: "CreditCard" },
      { href: "/admin/invoices", label: "Invoices", icon: "Receipt" },
      { href: "/admin/reports", label: "Reports", icon: "BarChart3" },
    ],
  },
  {
    label: "Team & Organization",
    items: [
      { href: "/admin/users", label: "Team & Users", icon: "Users" },
      { href: "/admin/employees", label: "Employees", icon: "GraduationCap" },
      { href: "/admin/branches", label: "Branches", icon: "GitBranch" },
      { href: "/admin/roles-permissions", label: "Roles & Permissions", icon: "ShieldCheck" },
    ],
  },
  {
    label: "System Administration",
    items: [
      { href: "/admin/data-management", label: "Data Management", icon: "Database" },
      { href: "/admin/branding", label: "Branding & Logo", icon: "Image" },
      { href: "/admin/marketing", label: "Marketing Site", icon: "Megaphone" },
      { href: "/admin/settings", label: "System Settings", icon: "Settings" },
      { href: "/admin/audit", label: "Audit Logs", icon: "ScrollText" },
      { href: "/admin/design-preview", label: "Design System", icon: "Palette" },
    ],
  },
  {
    label: "System Operations",
    items: [
      { href: "/admin/system", label: "Overview", icon: "LayoutDashboard" },
      { href: "/admin/system/backups", label: "Backup & Restore", icon: "DatabaseBackup" },
      { href: "/admin/system/security", label: "Security Center", icon: "ShieldCheck" },
      { href: "/admin/system/seo", label: "SEO", icon: "Search" },
      { href: "/admin/system/analytics", label: "Analytics & Pixels", icon: "BarChart3" },
      { href: "/admin/system/health", label: "System Health", icon: "Activity" },
      { href: "/admin/system/configuration", label: "Configuration", icon: "Settings" },
      { href: "/admin/system/logs", label: "Logs", icon: "FileText" },
      { href: "/admin/system/maintenance", label: "Maintenance", icon: "Wrench" },
      { href: "/admin/system/audit", label: "Audit Logs", icon: "ScrollText" },
    ],
  },
];

// Flatten for backwards compatibility
export const ADMIN_NAV: NavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

export const EMPLOYEE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/employee", label: "Dashboard", icon: "LayoutDashboard" }],
  },
  {
    label: "My Work",
    items: [
      { href: "/employee/students", label: "My Students", icon: "Users" },
      { href: "/employee/applications", label: "Applications", icon: "FolderKanban" },
      { href: "/employee/tasks", label: "Tasks", icon: "CheckSquare" },
      { href: "/employee/appointments", label: "Appointments", icon: "CalendarClock" },
    ],
  },
  {
    label: "Student Processing",
    items: [
      { href: "/employee/documents", label: "Documents", icon: "FileText" },
      { href: "/employee/visa", label: "Visa Management", icon: "Stamp" },
      { href: "/employee/universities", label: "Universities", icon: "Building2" },
      { href: "/employee/courses", label: "Courses", icon: "BookOpen" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/employee/leads", label: "Leads", icon: "Target" },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/employee/messages", label: "Messages", icon: "MessageSquare" },
      { href: "/employee/notifications", label: "Notifications", icon: "Bell" },
      { href: "/employee/support", label: "Support Tickets", icon: "LifeBuoy" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/employee/payments", label: "Payments", icon: "CreditCard" },
      { href: "/employee/invoices", label: "Invoices", icon: "Receipt" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/employee/reports", label: "Reports", icon: "BarChart3" },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/employee/design-preview", label: "Design System", icon: "Palette" },
    ],
  },
];

// Flatten for backwards compatibility
export const EMPLOYEE_NAV: NavItem[] = EMPLOYEE_NAV_GROUPS.flatMap((g) => g.items);

export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/student/universities", label: "Universities", icon: "Building2" },
  { href: "/student/courses", label: "Courses", icon: "BookOpen" },
  { href: "/student/applications", label: "Applications", icon: "FolderKanban" },
  { href: "/student/documents", label: "Documents", icon: "FileText" },
  { href: "/student/tasks", label: "Tasks", icon: "CheckSquare" },
  { href: "/student/invoices", label: "Invoices", icon: "Receipt" },
  { href: "/student/notifications", label: "Notifications", icon: "Bell" },
];
