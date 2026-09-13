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
 * Marketing homepage — fully dynamic content from admin panel.
 *
 * All sections read from the DB: hero, services, whyEuroscope, problems,
 * howWeHelp, trust, FAQ, CTA. Universities, courses, and countries are
 * also dynamic from the database.
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

  const content = await getMarketingContent();

  return (
    <>
      <HeroSection content={content} />
      <ServicesSection items={content.services} />
      <WhyEuroscopeSection items={content.whyEuroscope} />
      <DestinationSection />
      <ProblemSection items={content.problems} />
      <JourneyTimeline />
      <HowWeHelp items={content.howWeHelp} />
      <TrustSection items={content.trust} />
      <FAQ items={content.faq} />
      <CTASection content={content.cta} />
    </>
  );
}
