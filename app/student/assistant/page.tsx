import type { Metadata } from "next";
import { AssistantChat } from "@/components/student/assistant/assistant-chat";

export const metadata: Metadata = {
  title: "AI Assistant",
  description: "Ask questions about your application, courses, documents, and more.",
};

export const dynamic = "force-dynamic";

/**
 * /student/assistant — AI Student Assistant
 *
 * Full-screen chat experience for students. The student identity is
 * determined from the NextAuth session on the server side (never
 * from client input) by the /api/student/assistant/* routes.
 *
 * The UI is mobile-first:
 *  - Full-screen chat on mobile (320px–430px)
 *  - Max-width container on larger screens (768px+)
 *  - 44px+ touch targets throughout
 *  - Keyboard navigation (Enter to send, Shift+Enter for newline)
 *  - Screen-reader friendly (aria-live, role=log, aria-labels)
 *
 * The assistant is read-only in Phase 1 — it can answer questions
 * about the student's own data but cannot perform actions.
 */
export default function AssistantPage() {
  return <AssistantChat />;
}
