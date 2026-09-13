import type { Metadata } from "next";
import { Container, Section, Eyebrow } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { CTASection } from "@/components/marketing/sections";
import { PageHero } from "@/components/marketing/page-hero";
import { APP_NAME } from "@/lib/constants/app";

export const metadata: Metadata = {
  title: "About Euroscope — European Education Consultancy",
  description:
    "Euroscope is a European education consultancy. Learn about our mission, our counselors and how we help students study in Europe.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow={`About ${APP_NAME}`}
        title="We make the European dream achievable"
        subtitle={`${APP_NAME} is a European education consultancy built on one belief: that every student deserves personal guidance — not a faceless portal.`}
        cta={{ href: "/contact", label: "Book a Free Consultation" }}
      />

      <Section tone="default">
        <Container>
          <div className="mx-auto max-w-3xl euroscope-prose">
            <MarketingReveal>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Our story
              </h2>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {APP_NAME} started with a simple observation: students trying to
                study in Europe face a maze of information, deadlines and
                requirements — and most agencies treat them as numbers, not people.
                We set out to do things differently.
              </p>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                We&apos;re a consultancy, not a software company. Yes, we use
                technology to keep things organized — but the heart of what we do
                is personal counseling. When you work with us, you get a dedicated
                counselor who knows your case, understands your goals and walks
                with you from the first consultation to your arrival in Europe.
              </p>
            </MarketingReveal>
            <MarketingReveal delay={240}>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                We don&apos;t promise guaranteed visas or fake success rates. We
                promise honest guidance, a transparent process and a counselor who
                genuinely cares about getting you to Europe the right way.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <Section tone="muted">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <MarketingReveal>
              <Eyebrow className="justify-center">What We Stand For</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Our values
              </h2>
            </MarketingReveal>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Personal, not transactional",
                body: "Every student gets a dedicated counselor. We know your name, your case and your goals — not just your file number.",
              },
              {
                title: "Honest, not salesy",
                body: "We tell you the truth, even when it's not what you want to hear. No guaranteed visas, no fake success rates.",
              },
              {
                title: "European, not generic",
                body: "We specialize in Europe. Our counselors understand each country's universities, visa processes and culture.",
              },
            ].map((item, i) => (
              <MarketingReveal key={item.title} delay={i * 100}>
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
