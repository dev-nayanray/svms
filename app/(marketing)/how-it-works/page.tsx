import type { Metadata } from "next";
import { Container, Section, Eyebrow, MarketingButton } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { JourneyTimeline, CTASection } from "@/components/marketing/sections";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "How It Works — From Discovery to Europe",
  description:
    "See how Euroscope guides students through the complete European study journey — discover, plan, apply, prepare.",
};

export default function HowItWorksPage() {
  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0 euroscope-dot-bg opacity-40" aria-hidden />
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">How It Works</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                A simple path from idea to Europe
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
                Euroscope breaks down a complex journey into four clear stages — and supports
                every step along the way.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <Section tone="default">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { num: "01", title: "Discover", body: "Explore European universities, courses and admission requirements. Compare destinations and find your match.", cta: "Explore destinations" },
              { num: "02", title: "Plan", body: "Work with your counselor to choose your university, course and application strategy. Set your timeline.", cta: "Book a consultation" },
              { num: "03", title: "Apply", body: "Collect documents, submit applications and track offers — all in your student dashboard.", cta: "See student portal" },
              { num: "04", title: "Prepare", body: "Complete visa preparation, attend biometrics and interviews, and get ready for your European journey.", cta: "Start your journey" },
            ].map((step, i) => (
              <MarketingReveal key={step.num} delay={i * 100}>
                <div className="relative h-full rounded-2xl border border-border bg-card p-6">
                  <span className="font-display text-4xl font-bold text-primary/15" aria-hidden>
                    {step.num}
                  </span>
                  <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  <MarketingButton href="/contact" variant="ghost" size="sm" className="mt-4 -ml-2">
                    {step.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </MarketingButton>
                </div>
              </MarketingReveal>
            ))}
          </div>
        </Container>
      </Section>

      <JourneyTimeline />
      <CTASection />
    </>
  );
}
