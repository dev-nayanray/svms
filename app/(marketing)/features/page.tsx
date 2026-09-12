import type { Metadata } from "next";
import { Container, Section, Eyebrow } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { FeatureGrid, ProductShowcase } from "@/components/marketing/showcase";
import { TrustSection, CTASection } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Features — The Complete Euroscope Platform",
  description:
    "Student management, university discovery, application tracking, document management, visa workflow, payments, messaging and real-time notifications — all in one platform.",
};

export default function FeaturesPage() {
  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0 euroscope-grid-bg opacity-30" aria-hidden />
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">Features</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                The complete platform for European education
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
                Every tool your student journey needs — from first counselling session to arrival in Europe.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <FeatureGrid />
      <ProductShowcase />
      <TrustSection />
      <CTASection />
    </>
  );
}
