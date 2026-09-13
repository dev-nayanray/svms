import { ICONS, FaIcon } from "./icons";
import { Container, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import type { MarketingContent } from "@/lib/services/marketing-content";

/**
 * HeroSection — premium editorial company positioning.
 *
 * Design principles:
 *  - Dark navy background with gold radial accents (matches logo)
 *  - Clear visual hierarchy: badge → headline → subtext → CTAs → trust
 *  - Right-side collage with destination grid + floating cards
 *  - Generous spacing (py-24 md:py-32 lg:py-40)
 */
export function HeroSection({ content }: { content: MarketingContent }) {
  const { hero } = content;
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      {/* ── Background layers ── */}
      <div className="absolute inset-0" aria-hidden>
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink to-ink-surface" />
        {/* Navy radial glow — top center */}
        <div
          className="absolute -top-40 left-1/2 h-[800px] w-[1200px] -translate-x-1/2 rounded-full opacity-50 blur-[150px]"
          style={{ background: "radial-gradient(ellipse, #1e293b 0%, transparent 55%)" }}
        />
        {/* Gold radial glow — bottom left */}
        <div
          className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full opacity-15 blur-[120px]"
          style={{ background: "radial-gradient(circle, #d4af37 0%, transparent 70%)" }}
        />
        {/* Grid pattern */}
        <div className="absolute inset-0 euroscope-grid-bg opacity-[0.12]" />
      </div>

      <Container className="relative py-24 md:py-32 lg:py-40">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          {/* ── Left: company positioning ── */}
          <div className="max-w-xl">
            {/* Trust badge with pulsing dot */}
            <MarketingReveal>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="text-xs font-semibold tracking-wide text-white/85">
                  {hero.badge}
                </span>
              </div>
            </MarketingReveal>

            {/* Headline */}
            <MarketingReveal delay={80}>
              <h1 className="mt-8 font-display text-[2.5rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.75rem]">
                {hero.headlinePart1}{" "}
                <span className="block sm:inline">
                  <span className="euroscope-gradient-text">{hero.headlinePart2}</span>
                </span>
              </h1>
            </MarketingReveal>

            {/* Subheadline */}
            <MarketingReveal delay={160}>
              <p className="mt-6 text-lg leading-relaxed text-white/70 md:text-xl">
                {hero.subtitle}
              </p>
            </MarketingReveal>

            {/* CTAs */}
            <MarketingReveal delay={240}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <MarketingButton href={hero.ctaPrimaryHref} variant="primary" size="lg" className="w-full sm:w-auto">
                  {hero.ctaPrimaryText}
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
                </MarketingButton>
                <MarketingButton href={hero.ctaSecondaryHref} variant="secondary" size="lg" className="w-full sm:w-auto">
                  {hero.ctaSecondaryText}
                </MarketingButton>
              </div>
            </MarketingReveal>

            {/* Trust features row */}
            <MarketingReveal delay={320}>
              <div className="mt-12 flex items-center gap-6 border-t border-white/10 pt-8">
                {[
                  { icon: ICONS.users, label: "Personal counselors" },
                  { icon: ICONS.route, label: "End-to-end support" },
                  { icon: ICONS.earthEurope, label: "European expertise" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-accent ring-1 ring-white/10">
                      <FaIcon icon={item.icon} className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="text-xs font-medium text-white/60">{item.label}</span>
                  </div>
                ))}
              </div>
            </MarketingReveal>
          </div>

          {/* ── Right: visual collage ── */}
          <MarketingReveal delay={400}>
            <HeroCollage />
          </MarketingReveal>
        </div>
      </Container>
    </section>
  );
}

function HeroCollage() {
  const destinations = [
    { flag: "🇩🇪", name: "Germany" },
    { flag: "🇫🇷", name: "France" },
    { flag: "🇮🇹", name: "Italy" },
    { flag: "🇪🇸", name: "Spain" },
    { flag: "🇳🇱", name: "Netherlands" },
    { flag: "🇸🇪", name: "Sweden" },
    { flag: "🇫🇮", name: "Finland" },
    { flag: "🇮🇪", name: "Ireland" },
    { flag: "🇵🇱", name: "Poland" },
  ];

  return (
    <div className="relative">
      {/* Glow behind */}
      <div
        className="absolute inset-x-8 -bottom-4 -top-4 -z-10 rounded-3xl opacity-50 blur-3xl"
        style={{ background: "linear-gradient(135deg, #1e293b 0%, #d4af37 100%)" }}
        aria-hidden
      />

      {/* Main destinations card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-surface to-ink p-6 shadow-2xl shadow-black/40">
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              European Destinations
            </p>
            <p className="mt-1 font-display text-lg font-bold text-white">
              Where we place students
            </p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-white ring-1 ring-white/10">
            <FaIcon icon={ICONS.compass} className="h-5 w-5" aria-hidden />
          </span>
        </div>

        {/* Destinations grid */}
        <div className="my-6 grid grid-cols-3 gap-2">
          {destinations.map((dest) => (
            <div
              key={dest.name}
              className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-all duration-200 hover:border-accent/40 hover:bg-white/[0.08]"
            >
              <span className="text-2xl transition-transform group-hover:scale-110" aria-hidden>{dest.flag}</span>
              <span className="text-[10px] font-medium text-white/70">{dest.name}</span>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
          <div>
            <p className="font-display text-2xl font-bold text-white">15+</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Countries</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-white">10+</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Universities</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-white">18</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Journey steps</p>
          </div>
        </div>
      </div>

      {/* Floating counselor card — bottom-left */}
      <div className="absolute -bottom-6 -left-4 hidden max-w-[210px] rounded-xl border border-white/10 bg-card p-4 shadow-xl shadow-black/20 md:block">
        <div className="flex items-start gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/5">
            <FaIcon icon={ICONS.userGraduate} className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">Personal counselor</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              Dedicated expert guiding you through every step
            </p>
          </div>
        </div>
      </div>

      {/* Floating journey card — top-right */}
      <div className="absolute -top-5 -right-3 hidden rounded-xl border border-accent/30 bg-card p-3 shadow-xl shadow-black/20 md:block">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent ring-2 ring-accent/10">
            <FaIcon icon={ICONS.locationDot} className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Current stage</p>
            <p className="text-xs font-bold text-foreground">Visa Preparation</p>
          </div>
        </div>
      </div>
    </div>
  );
}
