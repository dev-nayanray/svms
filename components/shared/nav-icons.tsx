import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Target,
  FolderKanban,
  FileText,
  Building2,
  BookOpen,
  Globe,
  CalendarClock,
  Stamp,
  CheckSquare,
  MessageSquare,
  CreditCard,
  Receipt,
  BarChart3,
  Bell,
  Settings,
  ScrollText,
  GitBranch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Nav items are defined in server layouts, so icons must be referenced by
 * name (serializable) and resolved here inside the client components.
 */
export const NAV_ICONS = {
  LayoutDashboard,
  Users,
  GraduationCap,
  Target,
  FolderKanban,
  FileText,
  Building2,
  BookOpen,
  Globe,
  CalendarClock,
  Stamp,
  CheckSquare,
  MessageSquare,
  CreditCard,
  Receipt,
  BarChart3,
  Bell,
  Settings,
  ScrollText,
  GitBranch,
  ShieldCheck,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICONS;

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = NAV_ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden />;
}
