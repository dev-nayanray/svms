import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { JourneyTimeline } from "@/components/marketing/journey";
import { CtaSection } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "How It Works — Discover, Plan, Apply, Prepare",
  description:
    "Euroscope keeps your European study journey simple: discover opportunities, plan your strategy, apply with confidence, and prepare for your visa and travel.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <section className="bg-brand-gradient py-20 text-primary-foreground md:py-24">
          <div className="container-marketing">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
              How it works
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              From idea to arrival, in four steps
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              Euroscope keeps the entire European study journey organized — discover, plan, apply, and prepare, all in one place.
            </p>
          </div>
        </section>
        <HowItWorks />
        <JourneyTimeline />
        <CtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
