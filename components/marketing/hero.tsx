import { ICONS, FaIcon } from "./icons";
import { Container, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";

/**
 * HeroSection — editorial company positioning with FA icons.
 *
 * Premium dark hero with:
 *  - Multi-layer mesh gradient background
 *  - Company positioning on the left
 *  - Visual collage on the right with FA icons
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      {/* ── Background layers ── */}
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink to-ink-surface" />
        <div
          className="absolute -top-40 right-1/4 h-[600px] w-[700px] rounded-full opacity-35 blur-[120px]"
          style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 65%)" }}
        />
        <div
          className="absolute -bottom-20 -left-20 h-[500px] w-[500px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />
        <div className="absolute inset-0 euroscope-grid-bg opacity-25" />
      </div>

      <Container className="relative py-20 md:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — company positioning */}
          <div>
            <MarketingReveal>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
                <FaIcon icon={ICONS.sparkles} className="h-3.5 w-3.5 text-accent" aria-hidden />
                <span className="text-xs font-medium text-white/80">
                  European Education Consultancy
                </span>
              </div>
            </MarketingReveal>

            <MarketingReveal delay={80}>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Study in Europe.{" "}
                <span className="euroscope-gradient-text">Start Your Future.</span>
              </h1>
            </MarketingReveal>

            <MarketingReveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl">
                {APP_NAME} is a European education consultancy that guides students
                through every step — from choosing the right university to preparing
                your visa. We don&apos;t just give you a portal — we walk with you.
              </p>
            </MarketingReveal>

            <MarketingReveal delay={240}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
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
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                {[
                  { icon: ICONS.users, label: "Personal counselors" },
                  { icon: ICONS.route, label: "End-to-end support" },
                  { icon: ICONS.earthEurope, label: "European expertise" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1.5">
                    <FaIcon icon={item.icon} className="h-5 w-5 text-accent" aria-hidden />
                    <span className="text-xs font-medium text-white/60">{item.label}</span>
                  </div>
                ))}
              </div>
            </MarketingReveal>
          </div>

          {/* Right — visual collage */}
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
        className="absolute inset-x-4 -bottom-4 -top-4 -z-10 rounded-3xl opacity-40 blur-3xl"
        style={{ background: "linear-gradient(135deg, #1e40af 0%, #f59e0b 100%)" }}
        aria-hidden
      />

      {/* Main map card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-surface to-ink p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              European Destinations
            </p>
            <p className="font-display text-lg font-bold text-white">
              Where we place students
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white">
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
              className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-2.5 transition-all hover:border-accent/40 hover:bg-white/10"
            >
              <span className="text-2xl" aria-hidden>{dest.flag}</span>
              <span className="text-[10px] font-medium text-white/70">{dest.name}</span>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          <div>
            <p className="font-display text-2xl font-bold text-white">15+</p>
            <p className="text-[10px] text-white/50">Countries</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-white">10+</p>
            <p className="text-[10px] text-white/50">Universities</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-white">18</p>
            <p className="text-[10px] text-white/50">Journey steps</p>
          </div>
        </div>
      </div>

      {/* Floating counselor card — bottom-left */}
      <div className="absolute -bottom-6 -left-4 hidden max-w-[200px] rounded-xl border border-white/10 bg-card p-4 shadow-xl md:block">
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <FaIcon icon={ICONS.userGraduate} className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">Personal counselor</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Dedicated expert guiding you through every step
            </p>
          </div>
        </div>
      </div>

      {/* Floating journey card — top-right */}
      <div className="absolute -top-4 -right-2 hidden rounded-xl border border-accent/30 bg-card p-3 shadow-xl md:block">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">
            <FaIcon icon={ICONS.locationDot} className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Current stage</p>
            <p className="text-xs font-semibold text-foreground">Visa Preparation</p>
          </div>
        </div>
      </div>
    </div>
  );
}
