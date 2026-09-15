import { ICONS, FaIcon } from "./icons";
import { Container, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import type { MarketingContent } from "@/lib/types/marketing-content";

/**
 * HeroSection — premium editorial hero with animated gradient mesh,
 * floating stat cards, and a destination showcase collage.
 *
 * Design system:
 *  - Deep navy background (#0f172a → #1e293b) with gold accents (#d4af37)
 *  - Glassmorphic floating cards with backdrop blur
 *  - Animated gradient mesh using CSS (no JS animation = fast)
 *  - Generous spacing (py-24 md:py-32 lg:py-40)
 */
export function HeroSection({ content }: { content: MarketingContent }) {
  const { hero } = content;
  return (
    <section className="relative overflow-hidden text-white" style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0f172a 40%, #1a2744 100%)" }}>
      {/* ── Background layers ── */}
      <div className="absolute inset-0" aria-hidden>
        {/* Animated gradient mesh */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(30, 64, 175, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 10% 50%, rgba(212, 175, 55, 0.08) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 90% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)
            `,
          }}
        />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40"
          style={{ background: "linear-gradient(to top, #0a0f1e, transparent)" }}
        />
      </div>

      <Container className="relative py-24 md:py-32 lg:py-40">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ── Left: company positioning (7 cols) ── */}
          <div className="lg:col-span-7">
            {/* Trust badge with pulsing dot */}
            <MarketingReveal>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: "#d4af37" }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: "#d4af37" }} />
                </span>
                <span className="text-xs font-semibold tracking-wide text-white/85">
                  {hero.badge}
                </span>
              </div>
            </MarketingReveal>

            {/* Headline */}
            <MarketingReveal delay={80}>
              <h1 className="mt-8 text-[2.5rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.75rem]">
                {hero.headlinePart1}{" "}
                <span className="block sm:inline">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)" }}
                  >
                    {hero.headlinePart2}
                  </span>
                </span>
              </h1>
            </MarketingReveal>

            {/* Subheadline */}
            <MarketingReveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60 md:text-xl">
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

            {/* Stats bar — inline under CTAs */}
            <MarketingReveal delay={320}>
              <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
                {[
                  { value: "8+", label: "Countries" },
                  { value: "500+", label: "Universities" },
                  { value: "1000+", label: "Students guided" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-bold text-white sm:text-3xl">{stat.value}</p>
                    <p className="mt-0.5 text-xs text-white/50">{stat.label}</p>
                  </div>
                ))}
              </div>
            </MarketingReveal>
          </div>

          {/* ── Right: visual collage (5 cols) ── */}
          <MarketingReveal delay={400}>
            <div className="lg:col-span-5">
              <HeroCollage />
            </div>
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
    <div className="relative mx-auto max-w-md">
      {/* Glow behind */}
      <div
        className="absolute inset-x-8 -bottom-4 -top-4 -z-10 rounded-[2rem] opacity-40 blur-3xl"
        style={{ background: "linear-gradient(135deg, #1e293b 0%, #d4af37 100%)" }}
        aria-hidden
      />

      {/* Main destinations card — glassmorphic */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 p-6 shadow-2xl"
        style={{ background: "rgba(30, 41, 59, 0.6)", backdropFilter: "blur(20px)" }}
      >
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "#d4af37" }}>
              European Destinations
            </p>
            <p className="mt-1 text-lg font-bold text-white">
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
              className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-all duration-200 hover:border-white/30 hover:bg-white/[0.08]"
            >
              <span className="text-2xl transition-transform group-hover:scale-110" aria-hidden>{dest.flag}</span>
              <span className="text-[10px] font-medium text-white/70">{dest.name}</span>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
          <div>
            <p className="text-2xl font-bold text-white">15+</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Countries</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">10+</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Universities</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">18</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">Journey steps</p>
          </div>
        </div>
      </div>

      {/* Floating counselor card — bottom-left */}
      <div
        className="absolute -bottom-6 -left-4 hidden max-w-[210px] rounded-2xl border border-white/10 p-4 shadow-xl shadow-black/20 md:block"
        style={{ background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex items-start gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-2 ring-slate-200" style={{ backgroundColor: "rgba(30, 41, 59, 0.1)", color: "#1e293b" }}>
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

      {/* Floating journey card — top-right */}
      <div
        className="absolute -top-5 -right-3 hidden rounded-2xl border p-3 shadow-xl shadow-black/20 md:block"
        style={{ background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)", borderColor: "rgba(212, 175, 55, 0.3)" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-lg ring-2"
            style={{ backgroundColor: "rgba(212, 175, 55, 0.15)", color: "#b8941f", boxShadow: "0 0 0 2px rgba(212, 175, 55, 0.1)" }}
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
