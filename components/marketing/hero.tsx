import { ICONS, FaIcon } from "./icons";
import { Container, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import type { MarketingContent } from "@/lib/types/marketing-content";

/**
 * HeroSection — premium European education hero.
 *
 * Design analysis & decisions:
 *
 * PROBLEM with previous design:
 *  - Background was near-black (#0a0f1e) — too dark, too monotone,
 *    felt like a generic SaaS dashboard, not a premium European
 *    education consultancy
 *  - Gold accent was barely visible against the near-black bg
 *  - No visual energy or warmth — didn't convey "European" or "premium"
 *  - Didn't differentiate from competitors
 *
 * NEW design direction:
 *  - Rich deep indigo → royal blue gradient (#1a1a3e → #1e3a8a → #2563eb)
 *    - Indigo/blue evokes European flag, trust, academia, depth
 *    - Brighter than near-black — accent colors pop
 *    - Royal blue is a "European" color (EU flag is blue + gold stars)
 *  - Gold (#d4af37) accent is now visible and prominent against the
 *    brighter blue background
 *  - White text at 85% opacity is readable but not harsh
 *  - Glassmorphic collage card uses lighter translucent blue
 *  - Subtle constellation dots pattern (European stars theme)
 *  - Glow effects in gold + blue create depth without clutter
 *
 * Color palette:
 *  - Background: deep indigo #1a1a3e → royal blue #1e3a8a → #2563eb
 *  - Accent: gold #d4af37 → light gold #f5d76e (gradient text)
 *  - Text: white at 90% (headline), 65% (body), 50% (labels)
 *  - Glass cards: rgba(255,255,255,0.08) with backdrop-blur
 *  - Glow: gold rgba(212,175,55,0.15) + blue rgba(37,99,235,0.2)
 */
export function HeroSection({ content }: { content: MarketingContent }) {
  const { hero } = content;
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{
        background: "linear-gradient(135deg, #1a1a3e 0%, #1e3a8a 45%, #2563eb 100%)",
      }}
    >
      {/* ── Background layers ── */}
      <div className="absolute inset-0" aria-hidden>
        {/* Rich radial glows — gold top-left + blue bottom-right */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 50% at 15% 20%, rgba(212, 175, 55, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 60% at 85% 80%, rgba(37, 99, 235, 0.25) 0%, transparent 50%),
              radial-gradient(ellipse 80% 40% at 50% 100%, rgba(30, 58, 138, 0.4) 0%, transparent 60%)
            `,
          }}
        />

        {/* Constellation dots — subtle European stars theme */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />

        {/* Top gradient sheen — adds premium feel */}
        <div
          className="absolute inset-x-0 top-0 h-1/2"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)",
          }}
        />

        {/* Bottom fade to page bg */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32"
          style={{ background: "linear-gradient(to top, #1a1a3e, transparent)" }}
        />
      </div>

      <Container className="relative py-24 md:py-32 lg:py-40">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ── Left: company positioning (7 cols) ── */}
          <div className="lg:col-span-7">
            {/* Trust badge with pulsing gold dot */}
            <MarketingReveal>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{ backgroundColor: "#f5d76e" }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#d4af37" }}
                  />
                </span>
                <span className="text-xs font-semibold tracking-wide text-white/90">
                  {hero.badge}
                </span>
              </div>
            </MarketingReveal>

            {/* Headline — gold gradient on part 2 */}
            <MarketingReveal delay={80}>
              <h1 className="mt-8 text-[2.5rem] font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.75rem]">
                {hero.headlinePart1}{" "}
                <span className="block sm:inline">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #f5d76e 0%, #d4af37 40%, #f5d76e 80%, #d4af37 100%)",
                    }}
                  >
                    {hero.headlinePart2}
                  </span>
                </span>
              </h1>
            </MarketingReveal>

            {/* Subheadline */}
            <MarketingReveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl">
                {hero.subtitle}
              </p>
            </MarketingReveal>

            {/* CTAs */}
            <MarketingReveal delay={240}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
                {/* Primary CTA — gold filled, eye-catching */}
                <a
                  href={hero.ctaPrimaryHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    background: "linear-gradient(135deg, #d4af37 0%, #b8941f 100%)",
                    color: "#1a1a3e",
                    boxShadow: "0 4px 14px rgba(212, 175, 55, 0.3)",
                  }}
                >
                  {hero.ctaPrimaryText}
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
                </a>
                {/* Secondary CTA — glass outline */}
                <a
                  href={hero.ctaSecondaryHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20"
                >
                  {hero.ctaSecondaryText}
                </a>
              </div>
            </MarketingReveal>

            {/* Stats bar — inline under CTAs */}
            <MarketingReveal delay={320}>
              <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/15 pt-8">
                {[
                  { value: "8+", label: "Countries" },
                  { value: "500+", label: "Universities" },
                  { value: "1000+", label: "Students guided" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-bold sm:text-3xl" style={{ color: "#f5d76e" }}>
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-xs text-white/50">{stat.label}</p>
                  </div>
                ))}
              </div>
            </MarketingReveal>
          </div>

          {/* ── Right: visual collage (5 cols) ── */}
          <div className="lg:col-span-5">
            <MarketingReveal delay={400}>
              <HeroCollage />
            </MarketingReveal>
          </div>
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
    <div className="relative mx-auto max-w-md">
      {/* Glow behind — gold + blue mix */}
      <div
        className="absolute inset-x-8 -bottom-4 -top-4 -z-10 rounded-[2rem] opacity-50 blur-3xl"
        style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.3) 0%, rgba(37,99,235,0.3) 100%)" }}
        aria-hidden
      />

      {/* Main destinations card — premium glassmorphic */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/15 p-6 shadow-2xl"
        style={{ background: "rgba(255, 255, 255, 0.08)", backdropFilter: "blur(24px)" }}
      >
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-white/15 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "#f5d76e" }}>
              European Destinations
            </p>
            <p className="mt-1 text-lg font-bold text-white">
              Where we place students
            </p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/20">
            <FaIcon icon={ICONS.compass} className="h-5 w-5" aria-hidden />
          </span>
        </div>

        {/* Destinations grid */}
        <div className="my-6 grid grid-cols-3 gap-2">
          {destinations.map((dest) => (
            <div
              key={dest.name}
              className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 transition-all duration-200 hover:border-white/30 hover:bg-white/15"
            >
              <span className="text-2xl transition-transform group-hover:scale-110" aria-hidden>{dest.flag}</span>
              <span className="text-[10px] font-medium text-white/70">{dest.name}</span>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-3 border-t border-white/15 pt-5">
          <div>
            <p className="text-2xl font-bold" style={{ color: "#f5d76e" }}>15+</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Countries</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: "#f5d76e" }}>10+</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Universities</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: "#f5d76e" }}>18</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Journey steps</p>
          </div>
        </div>
      </div>

      {/* Floating counselor card — bottom-left, white glass */}
      <div
        className="absolute -bottom-6 -left-4 hidden max-w-[210px] rounded-2xl border border-white/20 p-4 shadow-xl shadow-black/30 md:block"
        style={{ background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-start gap-2.5">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-2 ring-blue-200"
            style={{ backgroundColor: "rgba(30, 58, 138, 0.1)", color: "#1e3a8a" }}
          >
            <FaIcon icon={ICONS.userGraduate} className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-900">Personal counselor</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
              Dedicated expert guiding you through every step
            </p>
          </div>
        </div>
      </div>

      {/* Floating journey card — top-right, gold-bordered */}
      <div
        className="absolute -top-5 -right-3 hidden rounded-2xl border p-3 shadow-xl shadow-black/30 md:block"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(212, 175, 55, 0.4)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-lg ring-2"
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.15)",
              color: "#b8941f",
              boxShadow: "0 0 0 2px rgba(212, 175, 55, 0.1)",
            }}
          >
            <FaIcon icon={ICONS.locationDot} className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Current stage</p>
            <p className="text-xs font-bold text-slate-900">Visa Preparation</p>
          </div>
        </div>
      </div>
    </div>
  );
}
