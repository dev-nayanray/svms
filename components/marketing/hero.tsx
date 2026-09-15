import { ICONS, FaIcon } from "./icons";
import { Container, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import type { MarketingContent } from "@/lib/types/marketing-content";

/**
 * HeroSection — light, premium, professional European education hero.
 *
 * Design philosophy:
 *  - Clean white/off-white background — feels premium (like Apple, Stripe)
 *  - Navy (#1e293b) text for contrast + gold (#d4af37) accents
 *  - Soft gradient mesh in pale blue/gold (not dark, not heavy)
 *  - Glassmorphic collage card on white with subtle shadow
 *  - Gold CTA button stands out against the light background
 *  - Generous whitespace = premium feel
 */
export function HeroSection({ content }: { content: MarketingContent }) {
  const { hero } = content;
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #fafbff 0%, #f0f4ff 50%, #fafaf9 100%)" }}
    >
      {/* ── Background layers ── */}
      <div className="absolute inset-0" aria-hidden>
        {/* Soft pale radial glows — barely there, premium */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 80% 10%, rgba(212, 175, 55, 0.06) 0%, transparent 50%),
              radial-gradient(ellipse 50% 50% at 10% 70%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)
            `,
          }}
        />
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `radial-gradient(circle, #cbd5e1 0.5px, transparent 0.5px)`,
            backgroundSize: "28px 28px",
          }}
        />
        {/* Bottom fade into page */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{ background: "linear-gradient(to top, #fafaf9, transparent)" }}
        />
      </div>

      <Container className="relative py-20 md:py-28 lg:py-36">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ── Left: company positioning (7 cols) ── */}
          <div className="lg:col-span-7">
            {/* Trust badge */}
            <MarketingReveal>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{ backgroundColor: "#d4af37" }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#d4af37" }}
                  />
                </span>
                <span className="text-xs font-semibold tracking-wide text-slate-700">
                  {hero.badge}
                </span>
              </div>
            </MarketingReveal>

            {/* Headline — navy text with gold gradient on part 2 */}
            <MarketingReveal delay={80}>
              <h1 className="mt-8 text-[2.5rem] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.75rem]">
                {hero.headlinePart1}{" "}
                <span className="block sm:inline">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #b8941f 0%, #d4af37 50%, #b8941f 100%)",
                    }}
                  >
                    {hero.headlinePart2}
                  </span>
                </span>
              </h1>
            </MarketingReveal>

            {/* Subheadline */}
            <MarketingReveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 md:text-xl">
                {hero.subtitle}
              </p>
            </MarketingReveal>

            {/* CTAs */}
            <MarketingReveal delay={240}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
                {/* Primary CTA — navy filled, premium */}
                <a
                  href={hero.ctaPrimaryHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                    boxShadow: "0 4px 14px rgba(30, 41, 59, 0.25)",
                  }}
                >
                  {hero.ctaPrimaryText}
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
                </a>
                {/* Secondary CTA — white with border */}
                <a
                  href={hero.ctaSecondaryHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 text-base font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"
                >
                  {hero.ctaSecondaryText}
                </a>
              </div>
            </MarketingReveal>

            {/* Stats bar */}
            <MarketingReveal delay={320}>
              <div className="mt-12 grid grid-cols-3 gap-4 border-t border-slate-200 pt-8">
                {[
                  { value: "8+", label: "Countries" },
                  { value: "500+", label: "Universities" },
                  { value: "1000+", label: "Students guided" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-bold text-slate-900 sm:text-3xl">{stat.value}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
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
      {/* Soft shadow behind */}
      <div
        className="absolute inset-x-4 -bottom-4 -top-4 -z-10 rounded-[2rem] opacity-30 blur-3xl"
        style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(59,130,246,0.2) 100%)" }}
        aria-hidden
      />

      {/* Main destinations card — clean white with shadow */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/50">
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "#b8941f" }}>
              European Destinations
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              Where we place students
            </p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
            <FaIcon icon={ICONS.compass} className="h-5 w-5" aria-hidden />
          </span>
        </div>

        {/* Destinations grid */}
        <div className="my-6 grid grid-cols-3 gap-2">
          {destinations.map((dest) => (
            <div
              key={dest.name}
              className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:shadow-sm"
            >
              <span className="text-2xl transition-transform group-hover:scale-110" aria-hidden>{dest.flag}</span>
              <span className="text-[10px] font-medium text-slate-600">{dest.name}</span>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-5">
          <div>
            <p className="text-2xl font-bold text-slate-900">15+</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Countries</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">10+</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Universities</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">18</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Journey steps</p>
          </div>
        </div>
      </div>

      {/* Floating counselor card — bottom-left, white with shadow */}
      <div className="absolute -bottom-6 -left-4 hidden max-w-[210px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:block">
        <div className="flex items-start gap-2.5">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-2 ring-slate-100"
            style={{ backgroundColor: "rgba(30, 41, 59, 0.05)", color: "#1e293b" }}
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

      {/* Floating journey card — top-right, gold-accented */}
      <div
        className="absolute -top-5 -right-3 hidden rounded-2xl border bg-white p-3 shadow-xl md:block"
        style={{ borderColor: "rgba(212, 175, 55, 0.3)" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-lg ring-2"
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.1)",
              color: "#b8941f",
              boxShadow: "0 0 0 2px rgba(212, 175, 55, 0.08)",
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
