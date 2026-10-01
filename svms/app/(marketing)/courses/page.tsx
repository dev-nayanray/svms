import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";
import { CtaSection } from "@/components/marketing/cta";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "Courses — European Study Programs",
  description:
    "Browse European study programs by degree level, tuition, and intake. Filter by country and university to find your ideal course.",
  alternates: { canonical: "/courses" },
};

export default function CoursesPage() {
  return (
    <>
      <MarketingNavbar />
      <main>
        <section className="bg-brand-gradient py-20 text-primary-foreground md:py-24">
          <div className="container-marketing">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">
              Courses
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Find the right European program for you
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              Filter by degree level, tuition range, country, and intake to discover programs that
              fit your goals.
            </p>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-background">
          <div className="container-marketing">
            <div className="card-elevated p-10 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Course discovery, built into the platform
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground text-pretty">
                The Euroscope course catalog is searchable inside the student portal and employee
                workspace. Browse programs across all supported destinations, shortlist favorites,
                and start applications with your counselor.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link href="/contact">
                  <Button size="lg">
                    Start Your Journey <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
                <Link href="/features">
                  <Button size="lg" variant="outline">
                    See platform features
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
