import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { CtaSection } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "About Euroscope — A modern European EdTech platform",
  description:
    "Euroscope is a complete platform for students planning to study in Europe — built around the realities of European university admissions and visa preparation.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <section className="bg-brand-gradient py-20 text-primary-foreground md:py-28">
          <div className="container-marketing">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
              About Euroscope
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              A modern European EdTech platform, not a traditional visa agency
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              Euroscope was built to bring the European study journey into one organized platform —
              replacing scattered spreadsheets, emails, and chat apps with a single source of truth
              for students, counselors, and administrators.
            </p>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-background">
          <div className="container-marketing">
            <div className="mx-auto max-w-3xl space-y-6 text-base text-muted-foreground">
              <p className="text-pretty">
                Euroscope is built around the realities of European university admissions and visa
                preparation. We support eight European destinations today — Germany, France, Italy,
                Spain, the Netherlands, Ireland, Sweden, and Finland — and we are continually
                expanding to additional countries.
              </p>
              <p className="text-pretty">
                The platform brings together the eighteen stages of the European student journey —
                from lead capture, through counselling and university selection, to visa preparation
                and travel — so nothing falls through the cracks. Every action is tracked, every
                change is audit-logged, and every role sees only what it is authorized to see.
              </p>
              <p className="text-pretty">
                Euroscope is designed for three roles: students planning their journey, education
                employees managing multiple cases, and administrators running the operation. Each
                role gets a workspace shaped around its needs, with the same underlying data and
                permissions model.
              </p>
              <p className="text-pretty">
                We do not guarantee visa approvals, claim specific success rates, or invent
                testimonials. We build a platform that helps students, counselors, and
                administrators work with clarity, accountability, and confidence.
              </p>
            </div>
          </div>
        </section>

        <CtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
