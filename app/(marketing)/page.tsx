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
import { getMarketingContent } from "@/lib/services/marketing-content";

/**
 * Marketing homepage — the public face of Euroscope.
 *
 * Content (hero, CTA, FAQ) is loaded dynamically from the DB so admins
 * can edit it from the admin panel at /admin/marketing.
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

  // Load dynamic content from DB (falls back to defaults if nothing stored)
  const content = await getMarketingContent();

  return (
    <>
      <HeroSection content={content} />
      <ServicesSection />
      <WhyEuroscopeSection />
      <DestinationSection />
      <ProblemSection />
      <JourneyTimeline />
      <HowWeHelp />
      <TrustSection />
      <FAQ items={content.faq} />
      <CTASection content={content.cta} />
    </>
  );
}
