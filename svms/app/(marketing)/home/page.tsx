import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { HeroSection } from "@/components/marketing/hero";
import { DestinationSection } from "@/components/marketing/destinations";
import { ProblemSection } from "@/components/marketing/problem";
import { SolutionSection } from "@/components/marketing/solution";
import { FeatureGrid } from "@/components/marketing/features";
import { JourneyTimeline } from "@/components/marketing/journey";
import { RoleExperience } from "@/components/marketing/role-experience";
import { SecuritySection } from "@/components/marketing/security";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FaqSection } from "@/components/marketing/faq";
import { CtaSection } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Study in Europe. Start Your Future.",
  description:
    "Euroscope helps students manage their entire European study journey — from university discovery to visa preparation — in one platform.",
  alternates: { canonical: "/" },
};

export default function MarketingHomePage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <DestinationSection />
        <FeatureGrid />
        <JourneyTimeline />
        <RoleExperience />
        <HowItWorks />
        <SecuritySection />
        <FaqSection />
        <CtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
