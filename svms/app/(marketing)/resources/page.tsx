import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { FaqSection } from "@/components/marketing/faq";
import { CtaSection } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Resources — Guides, FAQs, and Help",
  description:
    "Resources to help you navigate your European study journey — frequently asked questions, guides, and contact information.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <section className="bg-brand-gradient py-20 text-primary-foreground md:py-24">
          <div className="container-marketing">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
              Resources
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Guides, FAQs, and help
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              Everything you need to understand Euroscope and plan your European study journey.
            </p>
          </div>
        </section>

        <FaqSection />
        <CtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
