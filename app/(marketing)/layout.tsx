import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: {
    default: "Euroscope — Study in Europe. Start Your Future.",
    template: "%s | Euroscope",
  },
  description:
    "Euroscope helps students manage their entire European study journey — from choosing the right university to preparing your application and visa — all in one place.",
};

/**
 * Marketing route group layout — wraps every marketing page with the
 * premium navbar + footer. The route group `(marketing)` doesn't affect
 * the URL, so routes like /, /about, /contact stay clean.
 *
 * This layout is INDEPENDENT from the admin/employee/student layouts —
 * those panels have their own app shells and are not affected.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNavbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}
