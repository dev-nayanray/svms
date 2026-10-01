import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { CtaSection } from "@/components/marketing/cta";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "Universities — European University Directory",
  description:
    "Browse European universities supported by Euroscope. Explore courses, tuition, ranking, and application opportunities across eight destinations.",
  alternates: { canonical: "/universities" },
};

export default function UniversitiesPage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <section className="bg-brand-gradient py-20 text-primary-foreground md:py-24">
          <div className="container-marketing">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
              Universities
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              European universities, all in one directory
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              Explore universities across our supported destinations. Once you've shortlisted,
              your counselor can help you build a strategic application plan.
            </p>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-background">
          <div className="container-marketing">
            <div className="card-elevated p-10 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                University discovery comes built-in
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground text-pretty">
                Euroscope ships with a catalog of European universities and courses. The full
                directory is available inside the platform — students can filter by country, course
                level, tuition range, and intake.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link href="/contact">
                  <Button size="lg">
                    Start Your Journey <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
                <Link href="/study-in-europe">
                  <Button size="lg" variant="outline">
                    Browse destinations
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <CtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
