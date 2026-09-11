import type { Metadata } from "next";
import { ProfileView } from "@/components/student/profile/profile-view";

export const metadata: Metadata = {
  title: "My Profile",
  description: "View and manage your personal, contact, address, passport, academic, and English proficiency information.",
};

export const dynamic = "force-dynamic";

/**
 * Module 03 — My Profile (/student/profile)
 *
 * Server component renders the client-side profile view. Identity and
 * ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard).
 */
export default function ProfilePage() {
  return <ProfileView />;
}
