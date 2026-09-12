import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Container, Section, Eyebrow } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { CTASection } from "@/components/marketing/sections";
import Link from "next/link";

export const metadata: Metadata = {
  title: "European Universities — Browse Partner Universities",
  description:
    "Browse European universities available through Euroscope. Filter by country, ranking and application fee to find your match.",
};

export const dynamic = "force-dynamic";

export default async function UniversitiesPage() {
  const universities = await prisma.university.findMany({
    where: { deletedAt: null },
    include: { country: true },
    orderBy: [{ ranking: "asc" }, { name: "asc" }],
    take: 50,
  });

  const countries = await prisma.country.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0 euroscope-dot-bg opacity-40" aria-hidden />
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <MarketingReveal>
              <Eyebrow tone="accent" className="justify-center">Universities</Eyebrow>
            </MarketingReveal>
            <MarketingReveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                European universities, organized
              </h1>
            </MarketingReveal>
            <MarketingReveal delay={160}>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
                Browse universities across Europe — see rankings, application fees and available courses.
                Filter by country to narrow your search.
              </p>
            </MarketingReveal>
          </div>
        </Container>
      </Section>

      <Section tone="default">
        <Container>
          {/* Filter chips */}
          <div className="mb-8 flex flex-wrap gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              All ({universities.length})
            </span>
            {countries.slice(0, 10).map((c) => {
              const count = universities.filter((u) => u.countryId === c.id).length;
              if (count === 0) return null;
              return (
                <span
                  key={c.id}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
                >
                  {c.name} ({count})
                </span>
              );
            })}
          </div>

          {universities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No universities seeded yet. Run <code className="rounded bg-muted px-1.5 py-0.5">npm run seed</code> to populate.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {universities.map((uni, i) => (
                <MarketingReveal key={uni.id} delay={(i % 3) * 80}>
                  <Link
                    href={`/universities/${uni.slug}`}
                    className="group block h-full rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-display text-lg font-semibold tracking-tight">
                          {uni.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {uni.country?.name ?? "—"}
                        </p>
                      </div>
                      {uni.ranking && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          #{uni.ranking}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Application fee: {uni.applicationFee ? `€${uni.applicationFee}` : "Free"}
                      </span>
                      <span className="font-semibold text-primary group-hover:underline">
                        View details →
                      </span>
                    </div>
                  </Link>
                </MarketingReveal>
              ))}
            </div>
          )}
        </Container>
      </Section>

      <CTASection />
    </>
  );
}
