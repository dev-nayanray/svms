import { HeroSection } from "@/components/marketing/hero";
import { DestinationSection } from "@/components/marketing/destinations";
import {
  ProblemSection,
  JourneyTimeline,
  TrustSection,
  CTASection,
  TestimonialsSection,
} from "@/components/marketing/sections";
import { ServicesSection, WhyEuroscopeSection, HowWeHelp } from "@/components/marketing/services";
import { FAQ } from "@/components/marketing/faq";
import { getMarketingContent } from "@/lib/services/marketing-content";

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
      <TestimonialsSection />
      <TrustSection items={content.trust} />
      <FAQ items={content.faq} />
      <CTASection content={content.cta} />
    </>
  );
}
