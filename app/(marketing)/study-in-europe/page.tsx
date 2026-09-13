import type { Metadata } from "next";
import { Container, Section, Eyebrow, MarketingButton } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { DestinationSection } from "@/components/marketing/destinations";
import { CTASection } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Study in Europe — European Study Destinations",
  description:
    "Explore European study destinations with Euroscope. Germany, France, Italy, Netherlands, Sweden, Finland, Ireland and more — find the right university for you.",
};

export default function StudyInEuropePage() {
  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink to-ink-surface" />
          <div
            className="absolute -top-32 left-1/2 h-[700px] w-[1000px] -translate-x-1/2 rounded-full opacity-40 blur-[140px]"
            style={{ background: "radial-gradient(ellipse, #1e40af 0%, transparent 60%)" }}
          />
          <div
            className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full opacity-15 blur-[120px]"
            style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
          />
          <div className="absolute inset-0 euroscope-grid-bg opacity-[0.15]" />
        </div>
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">Study in Europe</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-6 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Where will you study?
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
                Europe is home to some of the world&apos;s oldest universities and most
                innovative research institutions. Our counselors help you find the
                right destination for your goals.
              </p>
            </MarketingReveal>
            <MarketingReveal delay={240}>
              <div className="mt-10 flex justify-center">
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
          <div className="mt-12 grid gap-6 md:grid-cols-3">
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
                  <h3 className="font-display text-lg font-bold tracking-tight">{item.title}</h3>
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
