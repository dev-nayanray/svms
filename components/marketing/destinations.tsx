import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";

/**
 * European destination data — reflects the countries Euroscope actually
 * supports in the platform (see prisma/seed.ts for the source of truth).
 *
 * Each destination card shows: country, emoji flag, popular study areas,
 * and a "Explore" CTA. NO fake success statistics, NO fake university
 * partnerships — just accurate platform capability claims.
 */
const EUROPEAN_DESTINATIONS = [
  {
    slug: "germany",
    name: "Germany",
    flag: "🇩🇪",
    blurb: "Public universities with low or no tuition fees — a top destination for engineering, computer science and business.",
    areas: ["Engineering", "Computer Science", "Business", "Medicine"],
  },
  {
    slug: "france",
    name: "France",
    flag: "🇫🇷",
    blurb: "World-class public universities and grandes écoles — strong in management, science and the arts.",
    areas: ["Business", "Science", "Fashion", "Engineering"],
  },
  {
    slug: "italy",
    name: "Italy",
    flag: "🇮🇹",
    blurb: "Affordable tuition and Europe's oldest universities — ideal for design, architecture and humanities.",
    areas: ["Design", "Architecture", "Humanities", "Medicine"],
  },
  {
    slug: "spain",
    name: "Spain",
    flag: "🇪🇸",
    blurb: "Warm climate, vibrant culture and strong business schools — a growing destination for international students.",
    areas: ["Business", "Tourism", "Engineering", "Arts"],
  },
  {
    slug: "netherlands",
    name: "Netherlands",
    flag: "🇳🇱",
    blurb: "Most English-taught programs in continental Europe — leading in engineering, agriculture and economics.",
    areas: ["Engineering", "Economics", "Data Science", "Agriculture"],
  },
  {
    slug: "sweden",
    name: "Sweden",
    flag: "🇸🇪",
    blurb: "Innovation-driven education with strong industry links — sustainability, technology and design focus.",
    areas: ["Sustainability", "Technology", "Design", "Engineering"],
  },
  {
    slug: "finland",
    name: "Finland",
    flag: "🇫🇮",
    blurb: "World-leading education system — excellent for education, technology and environmental sciences.",
    areas: ["Education", "Technology", "Environmental", "Design"],
  },
  {
    slug: "ireland",
    name: "Ireland",
    flag: "🇮🇪",
    blurb: "English-speaking EU country with strong tech and pharma industry — home to many global headquarters.",
    areas: ["Computer Science", "Pharma", "Business", "Finance"],
  },
];

export function DestinationSection() {
  return (
    <Section id="destinations" tone="default">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">Study in Europe</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Choose your European destination
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Euroscope supports applications to universities across Europe.
              Explore popular study destinations, courses and admission requirements.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EUROPEAN_DESTINATIONS.map((dest, i) => (
            <MarketingReveal key={dest.slug} delay={i * 80}>
              <Link
                href={`/study-in-europe/${dest.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden>{dest.flag}</span>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight">
                      {dest.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">Study in {dest.name}</p>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {dest.blurb}
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {dest.areas.map((area) => (
                    <li
                      key={area}
                      className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {area}
                    </li>
                  ))}
                </ul>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Explore {dest.name}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </MarketingReveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <MarketingButton href="/study-in-europe" variant="outline" size="lg">
            View all destinations
            <ArrowRight className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}
