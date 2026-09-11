import type { Metadata } from "next";
import { ModulePage } from "@/components/student/module-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <ModulePage title="Settings" description="Notification, theme and account preferences." module="08" />;
}
