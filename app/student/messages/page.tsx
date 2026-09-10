import type { Metadata } from "next";
import { ModulePage } from "@/components/student/module-page";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return <ModulePage title="Messages" description="Chat with your counselor." module="05" />;
}
