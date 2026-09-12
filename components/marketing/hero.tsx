import { ArrowRight, Sparkles, PlayCircle } from "lucide-react";
import { Container, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants/app";

/**
 * HeroSection — the first thing visitors see on the homepage.
 *
 * Premium dark hero with the Euroscope grid background, gradient
 * headline, and a realistic product UI mockup showing the student
 * dashboard. The mockup is HTML/CSS (not an image) so it loads
 * instantly, looks crisp on any DPI, and matches the actual product.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      {/* Background — subtle dot pattern + radial accent glow */}
      <div className="absolute inset-0 euroscope-dot-bg opacity-50" aria-hidden />
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full opacity-30 blur-[120px]"
        style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 70%)" }}
        aria-hidden
      />

      <Container className="relative py-20 md:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <MarketingReveal>
            <Eyebrow tone="accent" className="justify-center">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Your European Study Journey
            </Eyebrow>
          </MarketingReveal>

          <MarketingReveal delay={80}>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Study in Europe.{" "}
              <span className="euroscope-gradient-text">Start Your Future.</span>
            </h1>
          </MarketingReveal>

          <MarketingReveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
              From choosing the right European university to preparing your
              application and visa, {APP_NAME} helps students manage their entire
              journey from one place.
            </p>
          </MarketingReveal>

          <MarketingReveal delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <MarketingButton href="/contact" variant="primary" size="lg">
                Start Your Journey
                <ArrowRight className="h-4 w-4" aria-hidden />
              </MarketingButton>
              <MarketingButton href="/study-in-europe" variant="secondary" size="lg">
                Explore Europe
              </MarketingButton>
              <MarketingButton href="/contact" variant="ghost" size="lg" className="text-white/80 hover:text-white hover:bg-white/10">
                <PlayCircle className="h-4 w-4" aria-hidden />
                Book a Free Consultation
              </MarketingButton>
            </div>
          </MarketingReveal>
        </div>

        {/* Product UI mockup — student dashboard */}
        <MarketingReveal delay={320}>
          <ProductUIMockup />
        </MarketingReveal>

        {/* Tagline strip */}
        <MarketingReveal delay={400}>
          <p className="mt-14 text-center text-sm font-medium uppercase tracking-[0.2em] text-white/40">
            {APP_TAGLINE}
          </p>
        </MarketingReveal>
      </Container>
    </section>
  );
}

/**
 * ProductUIMockup — an HTML/CSS recreation of the student dashboard.
 *
 * NOT a stock image — this matches the actual Euroscope student panel
 * layout: app shell, application pipeline, document checklist, and
 * visa progress. Loaded instantly, crisp on any DPI.
 */
function ProductUIMockup() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      {/* Glow behind the mockup */}
      <div
        className="absolute inset-0 -z-10 translate-y-8 rounded-2xl opacity-50 blur-2xl"
        style={{ background: "linear-gradient(135deg, #1e40af 0%, #f59e0b 100%)" }}
        aria-hidden
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden />
          <span className="ml-3 truncate rounded-md bg-card px-3 py-1 text-xs text-muted-foreground">
            euroscope.app/student/dashboard
          </span>
        </div>

        {/* App content */}
        <div className="grid gap-4 bg-muted/30 p-4 md:grid-cols-12 md:p-6">
          {/* Sidebar */}
          <aside className="hidden md:col-span-2 md:block">
            <div className="space-y-1 rounded-xl border border-border bg-card p-3">
              {["Home", "Application", "Documents", "Tasks", "Messages", "Visa"].map((item, i) => (
                <div
                  key={item}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    i === 0 ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <span className={`h-3 w-3 rounded-sm ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} aria-hidden />
                  {item}
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
              <div className="mt-4 flex items-center gap-1.5">
                {["Lead", "Counseling", "Profile", "Country", "University", "Course", "Documents", "Application", "Offer", "Visa", "Travel", "Europe"].map((stage, i) => (
                  <div key={stage} className="flex-1">
                    <div
                      className={`h-1.5 rounded-full ${i < 6 ? "bg-primary" : "bg-border"}`}
                      aria-hidden
                    />
                    <p className={`mt-1 truncate text-[10px] ${i < 6 ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {stage}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cards row */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Documents</p>
                <p className="mt-1 font-display text-xl font-bold text-foreground">7 / 9</p>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-success" style={{ width: "78%" }} aria-hidden />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
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
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Tasks</p>
                <p className="mt-1 font-display text-xl font-bold text-foreground">3 active</p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-warning" aria-hidden /> Passport renewal
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden /> IELTS test
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
