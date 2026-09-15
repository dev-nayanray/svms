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
 *
 * IMPORTANT: This page is accessible to EVERYONE — guests, logged-in
 * students, employees, and admins. We do NOT redirect logged-in users
 * to their panel here. The navbar shows "Login" for guests and
 * "Dashboard" + "Logout" for logged-in users, so they can navigate
 * to their panel when they want. This lets logged-in users share
 * marketing links with friends/family without being bounced.
 */
export default async function HomePage() {
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
