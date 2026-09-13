import { ICONS, FaIcon } from "./icons";
import { Container, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";

/**
 * HeroSection — editorial company positioning with premium visual design.
 *
 * Design principles:
 *  - Strong visual hierarchy (big headline, clear subtext, prominent CTA)
 *  - Generous whitespace (py-24 md:py-32)
 *  - Multi-layer background (gradient + radial glows + grid)
 *  - Trust indicators below CTAs
 *  - Visual collage on the right (not a product mockup — agency feel)
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      {/* ── Background layers ── */}
      <div className="absolute inset-0" aria-hidden>
        {/* Base gradient — deep navy to slightly lighter */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink to-ink-surface" />
        {/* Blue radial glow — top center, large */}
        <div
          className="absolute -top-32 left-1/2 h-[700px] w-[1000px] -translate-x-1/2 rounded-full opacity-40 blur-[140px]"
          style={{ background: "radial-gradient(ellipse, #1e40af 0%, transparent 60%)" }}
        />
        {/* Gold radial glow — bottom left, smaller, warm accent */}
        <div
          className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full opacity-15 blur-[120px]"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 euroscope-grid-bg opacity-[0.15]" />
      </div>

      <Container className="relative py-24 md:py-32 lg:py-40">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          {/* ── Left: company positioning ── */}
          <div>
            {/* Trust badge */}
            <MarketingReveal>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="text-xs font-semibold tracking-wide text-white/85">
                  European Education Consultancy
                </span>
              </div>
            </MarketingReveal>

            {/* Headline */}
            <MarketingReveal delay={80}>
              <h1 className="mt-7 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[4rem]">
                Study in Europe.{" "}
                <span className="block sm:inline">
                  <span className="euroscope-gradient-text">Start Your Future.</span>
                </span>
              </h1>
            </MarketingReveal>

            {/* Subheadline */}
            <MarketingReveal delay={160}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl">
                {APP_NAME} is a European education consultancy that guides students
                through every step — from choosing the right university to preparing
                your visa. We don&apos;t just give you a portal — we walk with you.
              </p>
            </MarketingReveal>

            {/* CTAs */}
            <MarketingReveal delay={240}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <MarketingButton href="/contact" variant="primary" size="lg" className="w-full sm:w-auto">
                  Book a Free Consultation
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
                </MarketingButton>
                <MarketingButton href="/study-in-europe" variant="secondary" size="lg" className="w-full sm:w-auto">
                  Explore Europe
                </MarketingButton>
              </div>
            </MarketingReveal>

            {/* Trust features */}
            <MarketingReveal delay={320}>
              <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
                {[
                  { icon: ICONS.users, label: "Personal counselors" },
                  { icon: ICONS.route, label: "End-to-end support" },
                  { icon: ICONS.earthEurope, label: "European expertise" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-accent">
                      <FaIcon icon={item.icon} className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="text-xs font-medium leading-tight text-white/60">{item.label}</span>
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
  return (
    <div className="relative">
      {/* Glow behind */}
      <div
        className="absolute inset-x-8 -bottom-4 -top-4 -z-10 rounded-3xl opacity-50 blur-3xl"
        style={{ background: "linear-gradient(135deg, #1e40af 0%, #f59e0b 100%)" }}
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
          {[
            { flag: "🇩🇪", name: "Germany" },
            { flag: "🇫🇷", name: "France" },
            { flag: "🇮🇹", name: "Italy" },
            { flag: "🇪🇸", name: "Spain" },
            { flag: "🇳🇱", name: "Netherlands" },
            { flag: "🇸🇪", name: "Sweden" },
            { flag: "🇫🇮", name: "Finland" },
            { flag: "🇮🇪", name: "Ireland" },
            { flag: "🇵🇱", name: "Poland" },
          ].map((dest) => (
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
