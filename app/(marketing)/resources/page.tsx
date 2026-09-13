import type { Metadata } from "next";
import { Container, Section, MarketingButton } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { FAQ } from "@/components/marketing/faq";
import { CTASection } from "@/components/marketing/sections";
import { PageHero } from "@/components/marketing/page-hero";
import { ICONS, FaIcon } from "@/components/marketing/icons";

export const metadata: Metadata = {
  title: "Resources — Guides, FAQs and Help",
  description:
    "Find answers to common questions about studying in Europe, the Euroscope platform and the student journey.",
};

export default function ResourcesPage() {
  return (
    <>
      <PageHero
        eyebrow="Resources"
        title="Everything you need to know"
        subtitle="Guides, FAQs and help articles to support your European study journey."
        showCta={false}
      />

      <Section tone="default">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            <MarketingReveal>
              <div className="h-full rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <FaIcon icon={ICONS.courseSelection} className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold tracking-tight">Guides</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  In-depth articles on choosing a country, preparing documents, visa requirements
                  and more — coming soon.
                </p>
              </div>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <div className="h-full rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <FaIcon icon={ICONS.comments} className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold tracking-tight">Help Center</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Common questions answered below. For anything else, our team is one click away.
                </p>
                <MarketingButton href="/contact" variant="outline" size="sm" className="mt-4">
                  Contact support
                  <FaIcon icon={ICONS.arrowRight} className="h-3.5 w-3.5" aria-hidden />
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
