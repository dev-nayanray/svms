import { ArrowRight, Sparkles, PlayCircle, Star } from "lucide-react";
import { Container, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";

/**
 * HeroSection — the first thing visitors see.
 *
 * Premium dark hero with:
 *  - Multi-layer mesh gradient background (blue + gold radial glows)
 *  - Subtle grid pattern overlay
 *  - Bold gradient headline (6xl on desktop)
 *  - 3 CTAs with clear hierarchy
 *  - Trust indicators (stars, "Trusted by students" badge)
 *  - Realistic product UI mockup with floating cards
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      {/* ── Background layers ── */}
      <div className="absolute inset-0" aria-hidden>
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink to-ink-surface" />
        {/* Blue radial glow — top center */}
        <div
          className="absolute -top-40 left-1/2 h-[700px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
          style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 65%)" }}
        />
        {/* Gold radial glow — bottom left */}
        <div
          className="absolute -bottom-20 -left-20 h-[500px] w-[500px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />
        {/* Grid pattern */}
        <div className="absolute inset-0 euroscope-grid-bg opacity-30" />
      </div>

      <Container className="relative py-20 md:py-28 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Trust badge */}
          <MarketingReveal>
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
              <div className="flex -space-x-1" aria-hidden>
                {[0,1,2,3,4].map((i) => (
                  <span
                    key={i}
                    className="grid h-5 w-5 place-items-center rounded-full border-2 border-ink bg-gradient-to-br from-primary to-primary-hover text-[8px] font-bold"
                  >
                    {["🇩🇪","🇫🇷","🇮🇹","🇳🇱","🇸🇪"][i]}
                  </span>
                ))}
              </div>
              <span className="text-xs font-medium text-white/80">
                Your European study journey starts here
              </span>
            </div>
          </MarketingReveal>

          {/* Eyebrow */}
          <MarketingReveal delay={60}>
            <Eyebrow tone="accent" className="justify-center">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Study in Europe
            </Eyebrow>
          </MarketingReveal>

          {/* Headline */}
          <MarketingReveal delay={120}>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-[5.5rem]">
              Study in Europe.{" "}
              <span className="block sm:inline">
                <span className="euroscope-gradient-text">Start Your Future.</span>
              </span>
            </h1>
          </MarketingReveal>

          {/* Subheadline */}
          <MarketingReveal delay={200}>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
              From choosing the right European university to preparing your
              application and visa, {APP_NAME} helps students manage their entire
              journey from one place.
            </p>
          </MarketingReveal>

          {/* CTAs */}
          <MarketingReveal delay={280}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <MarketingButton href="/contact" variant="primary" size="lg" className="w-full sm:w-auto">
                Start Your Journey
                <ArrowRight className="h-4 w-4" aria-hidden />
              </MarketingButton>
              <MarketingButton href="/study-in-europe" variant="secondary" size="lg" className="w-full sm:w-auto">
                Explore Europe
              </MarketingButton>
              <MarketingButton
                href="/contact"
                variant="ghost"
                size="lg"
                className="w-full text-white/80 hover:text-white hover:bg-white/10 sm:w-auto"
              >
                <PlayCircle className="h-4 w-4" aria-hidden />
                Book a Free Consultation
              </MarketingButton>
            </div>
          </MarketingReveal>

          {/* Star rating */}
          <MarketingReveal delay={360}>
            <div className="mt-10 flex items-center justify-center gap-2 text-sm text-white/50">
              <div className="flex" aria-hidden>
                {[0,1,2,3,4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
              <span>Built for students, trusted by consultancies</span>
            </div>
          </MarketingReveal>
        </div>

        {/* Product UI mockup */}
        <MarketingReveal delay={440}>
          <ProductUIMockup />
        </MarketingReveal>
      </Container>
    </section>
  );
}

/**
 * ProductUIMockup — an HTML/CSS recreation of the student dashboard.
 * NOT a stock image — matches the actual Euroscope student panel
 * layout. Loaded instantly, crisp on any DPI.
 */
function ProductUIMockup() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      {/* Glow behind mockup */}
      <div
        className="absolute inset-x-8 -top-4 bottom-0 -z-10 rounded-3xl opacity-60 blur-3xl"
        style={{ background: "linear-gradient(135deg, #1e40af 0%, #f59e0b 100%)" }}
        aria-hidden
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/20">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden />
          <span className="ml-3 flex-1 truncate rounded-md bg-card px-3 py-1 text-xs text-muted-foreground">
            euroscope.app/student/dashboard
          </span>
        </div>

        {/* App content */}
        <div className="grid gap-4 bg-muted/30 p-4 md:grid-cols-12 md:p-6">
          {/* Sidebar */}
          <aside className="hidden md:col-span-2 md:block">
            <div className="space-y-1 rounded-xl border border-border bg-card p-3">
              {[
                { label: "Home", active: true, dot: "bg-primary" },
                { label: "Application", dot: "bg-muted-foreground/30" },
                { label: "Documents", dot: "bg-muted-foreground/30" },
                { label: "Tasks", dot: "bg-muted-foreground/30" },
                { label: "Messages", dot: "bg-accent" },
                { label: "Visa", dot: "bg-muted-foreground/30" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    item.active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-sm ${item.dot}`} aria-hidden />
                  {item.label}
                </div>
              ))}
            </div>
          </aside>

          {/* Main panel */}
          <div className="space-y-4 md:col-span-10">
            {/* Pipeline header */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Application Pipeline
                  </p>
                  <p className="font-display text-base font-semibold text-foreground">
                    TU Munich · MSc Computer Science
                  </p>
                </div>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  Stage 6 of 12
                </span>
              </div>
              {/* Pipeline progress */}
              <div className="mt-4 flex items-center gap-1">
                {["Lead", "Counseling", "Profile", "Country", "University", "Course", "Documents", "Application", "Offer", "Visa", "Travel", "Europe"].map((stage, i) => (
                  <div key={stage} className="flex-1">
                    <div
                      className={`h-1.5 rounded-full ${i < 6 ? "bg-primary" : i === 6 ? "bg-accent" : "bg-border"}`}
                      aria-hidden
                    />
                    <p className={`mt-1 hidden truncate text-[9px] sm:block ${i < 6 ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {stage}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cards row */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Documents</p>
                  <span className="text-xs font-semibold text-success">78%</span>
                </div>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">7 / 9</p>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-success" style={{ width: "78%" }} aria-hidden />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Visa Progress</p>
                <p className="mt-1 font-display text-xl font-bold text-foreground">Preparation</p>
                <div className="mt-2 flex items-center gap-1">
                  {["Prep", "Submit", "Biometric", "Decision"].map((s, i) => (
                    <span
                      key={s}
                      className={`flex-1 rounded-md px-1.5 py-0.5 text-center text-[10px] ${
                        i === 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Tasks</p>
                  <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">2 urgent</span>
                </div>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">3 active</p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-warning" aria-hidden /> Passport renewal
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden /> IELTS test booking
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent badge — bottom-right */}
      <div className="absolute -bottom-4 -right-4 hidden rounded-xl border border-accent/30 bg-card p-3 shadow-lg md:block">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Live update</p>
            <p className="text-xs font-semibold text-foreground">Document approved</p>
          </div>
        </div>
      </div>
    </div>
  );
}
