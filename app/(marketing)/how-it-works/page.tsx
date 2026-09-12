import type { Metadata } from "next";
import { Container, Section, Eyebrow, MarketingButton } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { JourneyTimeline, CTASection } from "@/components/marketing/sections";
import { HowWeHelp } from "@/components/marketing/services";

export const metadata: Metadata = {
  title: "How We Help — Your Path to Studying in Europe",
  description:
    "See how Euroscope guides students through the complete European study journey — free consultation, personalized plan, application support, visa and travel.",
};

export default function HowItWorksPage() {
  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full opacity-35 blur-[120px]"
            style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 60%)" }}
          />
          <div className="absolute inset-0 euroscope-dot-bg opacity-30" />
        </div>
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">How We Help</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
                We walk with you, every step
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
                From your first question to your first day in Europe, our counselors
                provide personal guidance through every stage of the journey.
              </p>
            </MarketingReveal>
            <MarketingReveal delay={240}>
              <div className="mt-8 flex justify-center">
                <MarketingButton href="/contact" variant="primary" size="lg">
                  Book a Free Consultation
                </MarketingButton>
              </div>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <HowWeHelp />
      <JourneyTimeline />
      <CTASection />
    </>
  );
}
