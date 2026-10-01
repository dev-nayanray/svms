/**
 * Student Panel navigation — simplified to 5 bottom-nav tabs.
 *
 * The 5 tabs are the most important destinations for a student:
 *   Home → dashboard (overview, next steps, quick actions)
 *   Universities → browse + compare study destinations
 *   Application → visa application progress + timeline
 *   Notifications → alerts + updates
 *   Profile → personal info, documents, messages, settings, logout
 *
 * The "More" bottom sheet is removed — all secondary destinations
 * (Documents, Messages, Tasks, Payments, etc.) are accessible from
 * the Profile page as quick-link cards.
 */

export const STUDENT_TABS = [
  { href: "/student", label: "Home", icon: "House" },
  { href: "/student/universities", label: "Universities", icon: "Building2" },
  { href: "/student/applications", label: "Application", icon: "FolderKanban" },
  { href: "/student/notifications", label: "Updates", icon: "Bell" },
  { href: "/student/profile", label: "Profile", icon: "UserRound" },
] as const;

/**
 * Secondary destinations — shown as quick-link cards on the Profile page.
 * Not in the bottom nav to keep it simple (5 tabs max).
 */
export const STUDENT_MORE = [
  { href: "/student/documents", label: "Documents", icon: "FileText" },
  { href: "/student/courses", label: "Courses", icon: "BookOpen" },
  { href: "/student/visa", label: "Visa", icon: "Stamp" },
  { href: "/student/tasks", label: "Tasks", icon: "CheckSquare" },
  { href: "/student/payments", label: "Payments", icon: "CreditCard" },
  { href: "/student/invoices", label: "Invoices", icon: "Receipt" },
  { href: "/student/appointments", label: "Appointments", icon: "CalendarClock" },
  { href: "/student/messages", label: "Messages", icon: "MessageSquare" },
  { href: "/student/support", label: "Support", icon: "LifeBuoy" },
  { href: "/student/settings", label: "Settings", icon: "Settings" },
  { href: "/student/design-preview", label: "Design System", icon: "Palette" },
] as const;

export type StudentTab = (typeof STUDENT_TABS)[number];
export type StudentMoreItem = (typeof STUDENT_MORE)[number];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/student") return pathname === "/student" || pathname.startsWith("/student/dashboard");
  return pathname === href || pathname.startsWith(href + "/");
}
