import type { Metadata } from "next";
import { ModulePage } from "@/components/student/module-page";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return <ModulePage title="Profile" description="Your personal information and contact details." module="02" />;
}
