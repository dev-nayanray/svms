import type { Metadata } from "next";
import { Container, Section, Eyebrow } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { CTASection } from "@/components/marketing/sections";
import { APP_NAME } from "@/lib/constants/app";

export const metadata: Metadata = {
  title: "About Euroscope — Our Mission for European Education",
  description:
    "Euroscope is a European education and student visa management platform. Learn about our mission, what we stand for and who we serve.",
};

export default function AboutPage() {
  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0 euroscope-grid-bg opacity-30" aria-hidden />
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">About {APP_NAME}</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                We make the European study journey manageable
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
                {APP_NAME} is built around one belief: that every student deserves a clear,
                organized path to European education — not a maze of paperwork and uncertainty.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <Section tone="default">
        <Container>
          <div className="mx-auto max-w-3xl euroscope-prose">
            <MarketingReveal>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Our mission
              </h2>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {APP_NAME} exists to remove the friction from European education. For too long,
                students have struggled with scattered information, complicated application
                processes and unclear visa requirements. We bring the entire journey — discovery,
                counselling, application, document management, visa preparation and travel — into
                one organized, transparent platform.
              </p>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                We don&apos;t promise guaranteed visas or fake success rates. We promise a
                well-organized process, transparent communication and a real product that helps
                students, counselors and education consultancies work together effectively.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <Section tone="muted">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "For Students",
                body: "A personal dashboard with application pipeline, documents, visa progress, deadlines, payments and direct messaging with your counselor.",
              },
              {
                title: "For Counselors",
                body: "A dedicated panel to manage assigned students, review documents, schedule appointments and track performance.",
              },
              {
                title: "For Consultancies",
                body: "Full admin oversight — branches, employees, finance, reports, roles, permissions and audit logs — in one platform.",
              },
            ].map((item, i) => (
              <MarketingReveal key={item.title} delay={i * 100}>
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
