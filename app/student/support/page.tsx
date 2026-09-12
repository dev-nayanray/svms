import type { Metadata } from "next";
import { SupportView } from "@/components/student/support/support-view";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Get help, browse FAQ, and submit support requests.",
};

export const dynamic = "force-dynamic";

/**
 * Module 16 — Help & Support (/student/support)
 *
 * Students can browse FAQ (searchable, category-filtered), submit
 * support requests, and view their own tickets. They can only view
 * their own support requests — ownership enforced at the API level.
 */
export default function SupportPage() {
  return <SupportView />;
}
