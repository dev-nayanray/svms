import type { Metadata } from "next";
import { Container, Section, Eyebrow, MarketingButton } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { FAQ } from "@/components/marketing/faq";
import { CTASection } from "@/components/marketing/sections";
import { ArrowRight, BookOpen, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Resources — Guides, FAQs and Help",
  description:
    "Find answers to common questions about studying in Europe, the Euroscope platform and the student journey.",
};

export default function ResourcesPage() {
  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0 euroscope-dot-bg opacity-40" aria-hidden />
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">Resources</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Everything you need to know
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
                Guides, FAQs and help articles to support your European study journey.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <Section tone="default">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            <MarketingReveal>
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <BookOpen className="h-8 w-8 text-primary" aria-hidden />
                <h2 className="mt-3 font-display text-lg font-semibold tracking-tight">Guides</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  In-depth articles on choosing a country, preparing documents, visa requirements
                  and more — coming soon.
                </p>
              </div>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <HelpCircle className="h-8 w-8 text-primary" aria-hidden />
                <h2 className="mt-3 font-display text-lg font-semibold tracking-tight">Help Center</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Common questions answered below. For anything else, our team is one click away.
                </p>
                <MarketingButton href="/contact" variant="outline" size="sm" className="mt-4">
                  Contact support
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </MarketingButton>
              </div>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <FAQ />
      <CTASection />
    </>
  );
}
