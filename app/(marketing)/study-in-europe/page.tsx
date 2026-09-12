import type { Metadata } from "next";
import { Container, Section, Eyebrow, MarketingButton } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { DestinationSection } from "@/components/marketing/destinations";
import { CTASection } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Study in Europe — European Study Destinations",
  description:
    "Explore European study destinations — Germany, France, Italy, Netherlands, Sweden, Finland, Ireland and more. Find universities, courses and admission requirements.",
};

export default function StudyInEuropePage() {
  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0 euroscope-grid-bg opacity-30" aria-hidden />
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">Study in Europe</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
                Your gateway to European education
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
                Europe is home to some of the world&apos;s oldest universities and most
                innovative research institutions. Explore where Euroscope can take you.
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

      <DestinationSection />

      <Section tone="muted">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <MarketingReveal>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Why study in Europe?
              </h2>
            </MarketingReveal>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "World-Class Education",
                body: "European universities consistently rank among the world's best. The Bologna Process ensures degree recognition across the continent.",
              },
              {
                title: "Affordable Tuition",
                body: "Many European countries — especially Germany, Norway and Finland — offer low or no tuition fees at public universities for international students.",
              },
              {
                title: "Post-Study Work Opportunities",
                body: "EU member states offer post-study work visas that let graduates stay and gain professional experience after their studies.",
              },
              {
                title: "Cultural Diversity",
                body: "Study in a multicultural environment with students from across the world — and travel freely within the Schengen Area.",
              },
              {
                title: "Research & Innovation",
                body: "Europe is a global leader in research funding and industry partnerships — ideal for STEM, business and the arts.",
              },
              {
                title: "English-Taught Programs",
                body: "Thousands of programs across continental Europe are taught entirely in English — no second language required to start.",
              },
            ].map((item, i) => (
              <MarketingReveal key={item.title} delay={i * 80}>
                <div className="h-full rounded-2xl border border-border bg-card p-6">
                  <h3 className="font-display text-lg font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </MarketingReveal>
            ))}
          </div>
        </Container>
      </Section>

      <CTASection />
    </>
  );
}
