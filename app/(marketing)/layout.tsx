import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingSessionProvider } from "@/components/marketing/session-provider";
import { FloatingSupportWidget } from "@/components/marketing/support-widget";

export const metadata: Metadata = {
  title: {
    default: "Euroscope — Study in Europe. Start Your Future.",
    template: "%s | Euroscope",
  },
  description:
    "Euroscope helps students manage their entire European study journey — from choosing the right university to preparing your application and visa — all in one place.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingSessionProvider>
      <MarketingNavbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
      <FloatingSupportWidget />
    </MarketingSessionProvider>
  );
}
