import type { Metadata } from "next";
import { NotificationsView } from "@/components/student/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Stay updated on your application, documents, payments, visa, and messages.",
};

export const dynamic = "force-dynamic";

/**
 * Module 14 — Student Notifications (/student/notifications)
 *
 * Server component renders the client-side NotificationsView. Identity
 * and ownership are enforced at the layout level (StudentLayout →
 * requireStudentProfile) and at the API level (studentApiGuard in
 * every /api/student/notifications* route).
 *
 * Students can view their own notifications ONLY. They can mark
 * individual notifications or all as read. The notification badge in
 * the app shell header polls /api/notifications for the unread count.
 */
export default function NotificationsPage() {
  return <NotificationsView />;
}
