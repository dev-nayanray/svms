import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { HeroSection } from "@/components/marketing/hero";
import { DestinationSection } from "@/components/marketing/destinations";
import {
  ProblemSection,
  JourneyTimeline,
  TrustSection,
  CTASection,
} from "@/components/marketing/sections";
import { ServicesSection, WhyEuroscopeSection, HowWeHelp } from "@/components/marketing/services";
import { FAQ } from "@/components/marketing/faq";

/**
 * Marketing homepage — the public face of Euroscope as a company.
 *
 * The page positions Euroscope as a European education consultancy:
 *  - Hero with company positioning (not a product mockup)
 *  - Services the company offers (not software features)
 *  - Why choose the company (not why use the platform)
 *  - How the company helps (not how the software works)
 *  - Destinations, journey timeline, trust, FAQ, CTA
 *
 * Authenticated users are redirected to their role's panel.
 * Pass `?preview=1` to bypass the redirect for previewing.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const session = await getSession();
  if (session.user.role && preview !== "1") {
    const role = session.user.role;
    redirect(role === "ADMIN" ? "/admin" : role === "EMPLOYEE" ? "/employee" : "/student");
  }

  return (
    <>
      <HeroSection />
      <ServicesSection />
      <WhyEuroscopeSection />
      <DestinationSection />
      <ProblemSection />
      <JourneyTimeline />
      <HowWeHelp />
      <TrustSection />
      <FAQ />
      <CTASection />
    </>
  );
}
