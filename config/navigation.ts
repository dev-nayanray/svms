import type { NavIconName } from "@/components/shared/nav-icons";

export type NavItem = { href: string; label: string; icon: NavIconName };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Admin Navigation — reorganized into 8 clear groups.
 *
 * Design principle: a sidebar should be scannable in 3 seconds.
 * Groups are ordered by frequency of use, not alphabetically.
 * The most-used items (Dashboard, CRM, Admissions) are at the top.
 */
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
      { href: "/admin/employees", label: "Employees", icon: "GraduationCap" },
    ],
  },
  {
    label: "Admissions",
    items: [
      { href: "/admin/applications", label: "Applications", icon: "FolderKanban" },
      { href: "/admin/universities", label: "Universities", icon: "Building2" },
      { href: "/admin/courses", label: "Courses", icon: "BookOpen" },
      { href: "/admin/intakes", label: "Intakes", icon: "CalendarClock" },
      { href: "/admin/countries", label: "Countries", icon: "Globe" },
      { href: "/admin/branches", label: "Branches", icon: "GitBranch" },
    ],
  },
  {
    label: "Documents & Visa",
    items: [
      { href: "/admin/documents", label: "Documents", icon: "FileText" },
      { href: "/admin/visa", label: "Visa", icon: "Stamp" },
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
    label: "Operations",
    items: [
      { href: "/admin/tasks", label: "Tasks", icon: "CheckSquare" },
      { href: "/admin/appointments", label: "Appointments", icon: "CalendarClock" },
      { href: "/admin/support", label: "Support", icon: "LifeBuoy" },
      { href: "/admin/messages", label: "Messages", icon: "MessageSquare" },
      { href: "/admin/notifications", label: "Notifications", icon: "Bell" },
    ],
  },
  {
    label: "AI & Automation",
    items: [
      { href: "/admin/ai", label: "AI Control Center", icon: "Brain" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Users", icon: "Users" },
      { href: "/admin/roles-permissions", label: "Roles & Permissions", icon: "ShieldCheck" },
      { href: "/admin/branding", label: "Branding", icon: "Image" },
      { href: "/admin/marketing", label: "Marketing CMS", icon: "Megaphone" },
      { href: "/admin/data-management", label: "Data Management", icon: "Database" },
      { href: "/admin/settings", label: "Settings", icon: "Settings" },
      { href: "/admin/audit", label: "Audit Logs", icon: "ScrollText" },
      { href: "/admin/system", label: "System Operations", icon: "DatabaseBackup" },
      { href: "/admin/design-preview", label: "Design System", icon: "Palette" },
    ],
  },
];

// Flatten for backwards compatibility
export const ADMIN_NAV: NavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

export const EMPLOYEE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [{ href: "/employee", label: "Dashboard", icon: "LayoutDashboard" }],
  },
  {
    label: "Sales & Admissions",
    items: [
      { href: "/employee/leads", label: "Leads", icon: "Target" },
      { href: "/employee/students", label: "My Students", icon: "Users" },
      { href: "/employee/applications", label: "My Applications", icon: "FolderKanban" },
      { href: "/employee/documents", label: "Documents", icon: "FileText" },
    ],
  },
  {
    label: "Academic",
    items: [
      { href: "/employee/universities", label: "Universities", icon: "Building2" },
      { href: "/employee/courses", label: "Courses", icon: "BookOpen" },
      { href: "/employee/intakes", label: "Intakes", icon: "CalendarClock" },
    ],
  },
  {
    label: "Visa",
    items: [{ href: "/employee/visa", label: "Visa", icon: "Stamp" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/employee/tasks", label: "Tasks", icon: "CheckSquare" },
      { href: "/employee/appointments", label: "Appointments", icon: "CalendarClock" },
      { href: "/employee/messages", label: "Messages", icon: "MessageSquare" },
      { href: "/employee/notifications", label: "Notifications", icon: "Bell" },
      { href: "/employee/support", label: "Support", icon: "LifeBuoy" },
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
      { href: "/employee/performance", label: "Performance", icon: "TrendingUp" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/employee/profile", label: "Profile", icon: "UserCircle" },
      { href: "/employee/settings", label: "Settings", icon: "Settings" },
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
