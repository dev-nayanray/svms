import type { Metadata } from "next";
import { MarketingContentEditor } from "@/components/admin/marketing-content-editor";

export const metadata: Metadata = {
  title: "Marketing Content",
  description: "Edit the marketing site hero, CTA, and FAQ content.",
};

export const dynamic = "force-dynamic";

export default function AdminMarketingPage() {
  return <MarketingContentEditor />;
}
