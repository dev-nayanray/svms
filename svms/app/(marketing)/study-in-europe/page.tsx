import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { CtaSection } from "@/components/marketing/cta";
import { SUPPORTED_DESTINATIONS } from "@/lib/constants/app";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "Study in Europe — Destinations & Opportunities",
  description:
    "Explore the European study destinations Euroscope supports — from Germany and France to Italy, Spain, the Netherlands, Ireland, Sweden, and Finland.",
  alternates: { canonical: "/study-in-europe" },
};

export default function StudyInEuropePage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <section className="bg-brand-gradient py-20 text-primary-foreground md:py-28">
          <div className="container-marketing">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
              Study in Europe
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Eight destinations. One platform to navigate them all.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              Each European country has its own application rhythm, visa requirements, and intake
              calendar. Euroscope helps you navigate every one with clarity.
            </p>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-background">
          <div className="container-marketing">
            <div className="grid gap-6 md:grid-cols-2">
              {SUPPORTED_DESTINATIONS.map((d) => (
                <div key={d.code} className="card-elevated p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl" aria-hidden>
                          {d.flag}
                        </span>
                        <div>
                          <h2 className="text-xl font-semibold">{d.name}</h2>
                          <p className="text-xs text-muted-foreground">Country code: {d.code}</p>
                        </div>
                      </div>
                      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Popular study areas
                      </h3>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {d.popular.map((p) => (
                          <li
                            key={p}
                            className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                          >
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground">
                      Explore universities, courses, and application requirements.
                    </p>
                    <Link href={`/universities?country=${d.code}`}>
                      <Button size="sm" variant="outline">
                        Explore {d.name} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
