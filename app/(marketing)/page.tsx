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

/**
 * Marketing Homepage
 *
 * Section ordering is optimized for the first-time visitor's questions:
 *
 *   1. HERO        — What is Euroscope? Who is it for? What should I do next?
 *   2. SERVICES    — How we help (the core value proposition)
 *   3. DESTINATIONS — Where can I study? (concrete, visual)
 *   4. WHY US      — Why choose Euroscope? (differentiators)
 *   5. PROBLEMS    — What challenges do we solve? (empathy)
 *   6. JOURNEY     — How does the process work? (timeline)
 *   7. HOW WE HELP  — Detailed step-by-step support
 *   8. TESTIMONIALS — Social proof
 *   9. TRUST        — Trust badges + guarantees
 *  10. FAQ         — Answer common questions
 *  11. CTA         — Final call to action
 *
 * The hero is the most important section — it must answer the 4 questions
 * within seconds. All other sections build trust + provide detail.
 */
export default async function HomePage() {
  const content = await getMarketingContent();

  return (
    <>
      <HeroSection content={content} />
      <ServicesSection items={content.services} />
      <DestinationSection />
      <WhyEuroscopeSection items={content.whyEuroscope} />
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
