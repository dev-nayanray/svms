import type { Metadata } from "next";
import { Container, Section, Eyebrow } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { ServicesSection, WhyEuroscopeSection } from "@/components/marketing/services";
import { TrustSection, CTASection } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Services — How Euroscope Helps You Study in Europe",
  description:
    "Personal counselling, university selection, application management, document guidance, visa preparation and travel support — end-to-end services for studying in Europe.",
};

export default function FeaturesPage() {
  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full opacity-35 blur-[120px]"
            style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 60%)" }}
          />
          <div className="absolute inset-0 euroscope-grid-bg opacity-20" />
        </div>
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">Our Services</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
                Personal guidance for every step
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
                From your first consultation to your arrival in Europe — our
                counselors provide end-to-end support tailored to you.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <ServicesSection />
      <WhyEuroscopeSection />
      <TrustSection />
      <CTASection />
    </>
  );
}
