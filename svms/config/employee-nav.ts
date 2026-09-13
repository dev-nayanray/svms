import {
  LayoutDashboard, Users, FolderKanban, Building2, BookOpen, FileText,
  Stamp, CheckSquare, CalendarClock, MessageSquare, Bell, CreditCard,
  Receipt, BarChart3, UserRound, Settings, type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * Employee sidebar — grouped by workspace area. Each item may declare a
 * permission key; the sidebar filters out items the caller lacks. Groups
 * with zero visible items are hidden entirely.
 */
export const EMPLOYEE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/employee", label: "Dashboard", icon: LayoutDashboard },
      { href: "/employee/students", label: "My Students", icon: Users, permission: "students.read" },
      { href: "/employee/leads", label: "My Leads", icon: FolderKanban, permission: "leads.read" },
      { href: "/employee/applications", label: "My Applications", icon: FolderKanban, permission: "applications.read" },
    ],
  },
  {
    label: "Admissions",
    items: [
      { href: "/employee/universities", label: "Universities", icon: Building2, permission: "universities.read" },
      { href: "/employee/courses", label: "Courses", icon: BookOpen, permission: "courses.read" },
      { href: "/employee/documents", label: "Documents", icon: FileText, permission: "documents.read" },
    ],
  },
  {
    label: "Visa",
    items: [
      { href: "/employee/visa", label: "Visa Management", icon: Stamp, permission: "visa.read" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/employee/tasks", label: "Tasks", icon: CheckSquare, permission: "tasks.read" },
      { href: "/employee/appointments", label: "Appointments", icon: CalendarClock, permission: "tasks.read" },
      { href: "/employee/messages", label: "Messages", icon: MessageSquare, permission: "messages.read" },
      { href: "/employee/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/employee/payments", label: "Payments", icon: CreditCard, permission: "payments.read" },
      { href: "/employee/invoices", label: "Invoices", icon: Receipt, permission: "invoices.read" },
    ],
  },
  {
    label: "Reporting",
    items: [
      { href: "/employee/reports", label: "Reports", icon: BarChart3, permission: "reports.read" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/employee/profile", label: "Profile", icon: UserRound },
      { href: "/employee/settings", label: "Settings", icon: Settings },
    ],
  },
];

/**
 * Page titles for the header + breadcrumb derivation. Falls back to a
 * title-cased version of the last path segment when no explicit entry
 * exists (e.g. /employee/applications/APP-001 → "Applications").
 */
export const PAGE_TITLES: Record<string, string> = {
  "/employee": "Dashboard",
  "/employee/students": "My Students",
  "/employee/leads": "My Leads",
  "/employee/applications": "My Applications",
  "/employee/documents": "Documents",
  "/employee/universities": "Universities",
  "/employee/courses": "Courses",
  "/employee/visa": "Visa Management",
  "/employee/tasks": "Tasks",
  "/employee/appointments": "Appointments",
  "/employee/messages": "Messages",
  "/employee/notifications": "Notifications",
  "/employee/payments": "Payments",
  "/employee/invoices": "Invoices",
  "/employee/reports": "Reports",
  "/employee/profile": "Profile",
  "/employee/settings": "Settings",
};
