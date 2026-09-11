import type { Metadata } from "next";
import { ModulePage } from "@/components/student/module-page";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return <ModulePage title="Support" description="Get help and answers to common questions." module="07" />;
}
