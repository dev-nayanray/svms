import type { Metadata } from "next";
import { JourneyTimeline, CTASection } from "@/components/marketing/sections";
import { HowWeHelp } from "@/components/marketing/services";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "How We Help — Your Path to Studying in Europe",
  description:
    "See how Euroscope guides students through the complete European study journey — free consultation, personalized plan, application support, visa and travel.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How We Help"
        title="We walk with you, every step"
        subtitle="From your first question to your first day in Europe, our counselors provide personal guidance through every stage of the journey."
        cta={{ href: "/contact", label: "Book a Free Consultation" }}
      />

      <HowWeHelp />
      <JourneyTimeline />
      <CTASection />
    </>
  );
}
