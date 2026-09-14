import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Container, Section, Eyebrow, MarketingButton } from "@/components/marketing/ui";
import { MarketingReveal } from "@/components/marketing/reveal";
import { CTASection } from "@/components/marketing/sections";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ country: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { country: slug } = await params;
  // Normalize the slug: convert hyphens to spaces for name matching.
  // e.g. "czech-republic" → "czech republic" → matches "Czech Republic"
  const slugForName = slug.replace(/-/g, " ");
  const country = await prisma.country.findFirst({
    where: {
      OR: [
        { code: slug.toUpperCase() },
        { name: { contains: slugForName, mode: "insensitive" } },
        { name: { equals: slugForName, mode: "insensitive" } },
      ],
    },
  });
  if (!country) {
    return { title: "Destination not found" };
  }
  return {
    title: `Study in ${country.name} — Euroscope`,
    description: `Explore universities, courses and admission requirements for studying in ${country.name}.`,
  };
}

export default async function CountryDetailPage({ params }: Params) {
  const { country: slug } = await params;
  const slugForName = slug.replace(/-/g, " ");
  const country = await prisma.country.findFirst({
    where: {
      OR: [
        { code: slug.toUpperCase() },
        { name: { contains: slugForName, mode: "insensitive" } },
        { name: { equals: slugForName, mode: "insensitive" } },
      ],
    },
  });
  if (!country) notFound();

  const universities = await prisma.university.findMany({
    where: { countryId: country.id, deletedAt: null },
    include: { country: true },
    orderBy: { ranking: "asc" },
  });

  const visaRequirements = await prisma.visaRequirement.findMany({
    where: { countryId: country.id, status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <Section tone="dark" className="relative overflow-hidden">
        <div className="absolute inset-0 euroscope-grid-bg opacity-30" aria-hidden />
        <Container className="relative">
          <MarketingReveal>
            <Eyebrow tone="accent" className="justify-center">Study in {country.name}</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h1 className="mt-4 text-center font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              Study in {country.name}
            </h1>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-white/70">
              Explore universities, courses and admission requirements for studying in {country.name}.
              Currency: {country.currency}.
            </p>
          </MarketingReveal>
          <MarketingReveal delay={240}>
            <div className="mt-8 flex justify-center">
              <MarketingButton href="/contact" variant="primary" size="lg">
                Start your {country.name} application
              </MarketingButton>
            </div>
          </MarketingReveal>
        </Container>
      </Section>

      <Section tone="default">
        <Container>
          <div className="mx-auto max-w-2xl">
            <MarketingReveal>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Universities in {country.name}
              </h2>
            </MarketingReveal>
          </div>
          {universities.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No universities seeded for {country.name} yet.
            </p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {universities.map((uni, i) => (
                <MarketingReveal key={uni.id} delay={i * 80}>
                  <Link
                    href={`/universities/${uni.slug}`}
                    className="group block h-full rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    <h3 className="font-display text-lg font-semibold tracking-tight">
                      {uni.name}
                    </h3>
                    {uni.ranking && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        World ranking #{uni.ranking}
                      </p>
                    )}
                    <p className="mt-3 text-sm text-muted-foreground">
                      Application fee: {uni.applicationFee ? `${country.currency} ${uni.applicationFee}` : "Free"}
                    </p>
                  </Link>
                </MarketingReveal>
              ))}
            </div>
          )}
        </Container>
      </Section>

      {visaRequirements.length > 0 && (
        <Section tone="muted">
          <Container>
            <div className="mx-auto max-w-2xl">
              <MarketingReveal>
                <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Visa requirements — {country.name}
                </h2>
              </MarketingReveal>
              <MarketingReveal delay={80}>
                <p className="mt-2 text-sm text-muted-foreground">
                  Common requirements for a {country.name} student visa. Your counselor will
                  guide you through each step.
                </p>
              </MarketingReveal>
            </div>
            <ul className="mx-auto mt-8 max-w-2xl space-y-2">
              {visaRequirements.map((req, i) => (
                <MarketingReveal key={req.id} delay={i * 50}>
                  <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground">{req.name}</span>
                  </li>
                </MarketingReveal>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      <CTASection />
    </>
  );
}
