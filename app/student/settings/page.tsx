import type { Metadata } from "next";
import { SettingsView } from "@/components/student/settings/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account, notifications, appearance, and security preferences.",
};

export const dynamic = "force-dynamic";

/**
 * Module 17 — Student Settings (/student/settings)
 *
 * Students can manage: notification preferences (7 categories),
 * theme (system/light/dark), language (English/Bangla), change
 * password, and logout. Protected fields (role, status, branchId,
 * assignedEmployeeId) are never exposed or editable.
 */
export default function SettingsPage() {
  return <SettingsView />;
}
