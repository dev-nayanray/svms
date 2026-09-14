/**
 * Student Panel navigation. Icons are referenced by name (serializable
 * across the server/client boundary) and resolved in the client shell,
 * mirroring the admin navigation pattern.
 */

export const STUDENT_TABS = [
  { href: "/student", label: "Home", icon: "House" },
  { href: "/student/applications", label: "Application", icon: "FolderKanban" },
  { href: "/student/documents", label: "Documents", icon: "FileText" },
  { href: "/student/messages", label: "Messages", icon: "MessageSquare" },
] as const;

export const STUDENT_MORE = [
  { href: "/student/profile", label: "Profile", icon: "UserRound" },
  { href: "/student/universities", label: "Universities", icon: "Building2" },
  { href: "/student/courses", label: "Courses", icon: "BookOpen" },
  { href: "/student/visa", label: "Visa", icon: "Stamp" },
  { href: "/student/tasks", label: "Tasks", icon: "CheckSquare" },
  { href: "/student/payments", label: "Payments", icon: "CreditCard" },
  { href: "/student/invoices", label: "Invoices", icon: "Receipt" },
  { href: "/student/appointments", label: "Appointments", icon: "CalendarClock" },
  { href: "/student/notifications", label: "Notifications", icon: "Bell" },
  { href: "/student/support", label: "Support", icon: "LifeBuoy" },
  { href: "/student/settings", label: "Settings", icon: "Settings" },
] as const;

export type StudentTab = (typeof STUDENT_TABS)[number];
export type StudentMoreItem = (typeof STUDENT_MORE)[number];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/student") return pathname === "/student" || pathname.startsWith("/student/dashboard");
  return pathname === href || pathname.startsWith(href + "/");
}
