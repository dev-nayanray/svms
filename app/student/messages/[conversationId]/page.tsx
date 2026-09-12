import type { Metadata } from "next";
import { ChatView } from "@/components/student/messages/chat-view";

export const metadata: Metadata = {
  title: "Chat",
  description: "Conversation with your counselor.",
};

export const dynamic = "force-dynamic";

/**
 * Module 13 — Chat View (/student/messages/[conversationId])
 *
 * Full-height chat experience with message bubbles, date separators,
 * read receipts, and a sticky composer. Polls every 5 seconds for
 * new messages (TanStack Query refetchInterval — no WebSocket
 * infrastructure needed).
 *
 * Ownership is enforced at the API level (studentApiGuard). Foreign
 * conversation ids 404 cleanly.
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <ChatView conversationId={conversationId} />;
}
