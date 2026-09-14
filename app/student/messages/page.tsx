import type { Metadata } from "next";
import { MessagesView } from "@/components/student/messages/messages-view";

export const metadata: Metadata = {
  title: "Messages",
  description: "Chat with your assigned counselor.",
};

export const dynamic = "force-dynamic";

/**
 * Module 13 — Student Messages (/student/messages)
 *
 * Server component renders the client-side MessagesView (inbox). The
 * inbox shows all conversations between the student and their
 * counselor, with unread badges and auto-refresh every 30 seconds.
 *
 * Students can only access conversations they belong to (enforced by
 * studentApiGuard in every /api/student/messages* route).
 */
export default function MessagesPage() {
  return <MessagesView />;
}
