import Link from "next/link";
import { ICONS, FaIcon } from "./icons";
import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";

/**
 * European destination data — reflects the countries Euroscope actually
 * supports in the platform (see prisma/seed.ts for the source of truth).
 */
const EUROPEAN_DESTINATIONS = [
  {
    slug: "germany",
    name: "Germany",
    flag: "🇩🇪",
    blurb: "Public universities with low or no tuition fees — a top destination for engineering, computer science and business.",
    areas: ["Engineering", "Computer Science", "Business"],
    accent: "from-blue-500/20 to-blue-600/5",
  },
  {
    slug: "france",
    name: "France",
    flag: "🇫🇷",
    blurb: "World-class public universities and grandes écoles — strong in management, science and the arts.",
    areas: ["Business", "Science", "Fashion"],
    accent: "from-indigo-500/20 to-indigo-600/5",
  },
  {
    slug: "italy",
    name: "Italy",
    flag: "🇮🇹",
    blurb: "Affordable tuition and Europe's oldest universities — ideal for design, architecture and humanities.",
    areas: ["Design", "Architecture", "Humanities"],
    accent: "from-emerald-500/20 to-emerald-600/5",
  },
  {
    slug: "spain",
    name: "Spain",
    flag: "🇪🇸",
    blurb: "Warm climate, vibrant culture and strong business schools — a growing destination for international students.",
    areas: ["Business", "Tourism", "Arts"],
    accent: "from-amber-500/20 to-amber-600/5",
  },
  {
    slug: "netherlands",
    name: "Netherlands",
    flag: "🇳🇱",
    blurb: "Most English-taught programs in continental Europe — leading in engineering, agriculture and economics.",
    areas: ["Engineering", "Economics", "Data Science"],
    accent: "from-orange-500/20 to-orange-600/5",
  },
  {
    slug: "sweden",
    name: "Sweden",
    flag: "🇸🇪",
    blurb: "Innovation-driven education with strong industry links — sustainability, technology and design focus.",
    areas: ["Sustainability", "Technology", "Design"],
    accent: "from-sky-500/20 to-sky-600/5",
  },
  {
    slug: "finland",
    name: "Finland",
    flag: "🇫🇮",
    blurb: "World-leading education system — excellent for education, technology and environmental sciences.",
    areas: ["Education", "Technology", "Environmental"],
    accent: "from-cyan-500/20 to-cyan-600/5",
  },
  {
    slug: "ireland",
    name: "Ireland",
    flag: "🇮🇪",
    blurb: "English-speaking EU country with strong tech and pharma industry — home to many global headquarters.",
    areas: ["Computer Science", "Pharma", "Business"],
    accent: "from-green-500/20 to-green-600/5",
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
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Choose your European destination
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              Euroscope supports applications to universities across Europe.
              Explore popular study destinations, courses and admission requirements.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {EUROPEAN_DESTINATIONS.map((dest, i) => (
            <MarketingReveal key={dest.slug} delay={(i % 4) * 80}>
              <Link
                href={`/study-in-europe/${dest.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
              >
                {/* Accent gradient on hover */}
                <div
                  className={`absolute inset-0 -z-10 bg-gradient-to-br ${dest.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  aria-hidden
                />
                {/* Flag + name */}
                <div className="flex items-center gap-3">
                  <span className="text-4xl" aria-hidden>{dest.flag}</span>
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-tight">
                      {dest.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">Study in {dest.name}</p>
                  </div>
                </div>
                {/* Blurb */}
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {dest.blurb}
                </p>
                {/* Study areas */}
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {dest.areas.map((area) => (
                    <li
                      key={area}
                      className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {area}
                    </li>
                  ))}
                </ul>
                {/* CTA */}
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Explore {dest.name}
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            </MarketingReveal>
          ))}
        </div>

        <div className="mt-14 text-center">
          <MarketingButton href="/study-in-europe" variant="outline" size="lg">
            View all destinations
            <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}
