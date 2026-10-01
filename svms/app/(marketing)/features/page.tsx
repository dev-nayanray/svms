import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { FeatureGrid } from "@/components/marketing/features";
import { CtaSection } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "Features — Built around the European student journey",
  description:
    "Student management, university discovery, application tracking, document management, visa workflow, payments, communication, and reports — all in one platform.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <section className="bg-brand-gradient py-20 text-primary-foreground md:py-24">
          <div className="container-marketing">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
              Platform features
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Built around the European student journey
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              Every feature in Euroscope is designed to simplify a specific pain point in the
              study-abroad process — from first lead to arrival in Europe.
            </p>
          </div>
        </section>
        <FeatureGrid />
        <CtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
