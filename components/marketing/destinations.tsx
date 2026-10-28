import Link from "next/link";
import { ICONS, FaIcon } from "./icons";
import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";

/**
 * Destination data — reflects the countries Euroscope actually works with
 * (managed under Admin → Countries; the /study-in-europe/[country] pages
 * render live university data from the platform).
 */
const EUROPEAN_DESTINATIONS = [
  {
    slug: "bulgaria",
    name: "Bulgaria",
    flag: "🇧🇬",
    blurb: "EU-member country with recognized universities, low tuition and living costs — home of our partner Burgas Free University.",
    areas: ["Business", "Computer Science", "Engineering"],
    accent: "from-emerald-500/20 to-emerald-600/5",
  },
  {
    slug: "romania",
    name: "Romania",
    flag: "🇷🇴",
    blurb: "Affordable EU universities with English-taught programs in medicine, engineering and IT.",
    areas: ["Medicine", "Engineering", "IT"],
    accent: "from-blue-500/20 to-blue-600/5",
  },
  {
    slug: "uzbekistan",
    name: "Uzbekistan",
    flag: "🇺🇿",
    blurb: "Growing hub for medical and engineering education with a simple admission process and low costs.",
    areas: ["Medicine", "Engineering", "Business"],
    accent: "from-sky-500/20 to-sky-600/5",
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
              Choose your study destination
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              Euroscope supports applications to universities in Bulgaria, Romania and
              Uzbekistan — explore destinations, courses and admission requirements.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {EUROPEAN_DESTINATIONS.map((dest, i) => (
            <MarketingReveal key={dest.slug} delay={(i % 3) * 80}>
              <Link
                href={`/study-in-europe/${dest.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
              >
                {/* Accent gradient on hover */}
                <div
                  className={`absolute inset-0 -z-10 bg-gradient-to-br ${dest.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  aria-hidden
                />
                {/* Flag + name */}
                <div className="flex items-center gap-3">
                  <span className="text-4xl drop-shadow-sm" aria-hidden>{dest.flag}</span>
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
