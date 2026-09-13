import Link from "next/link";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-brand-gradient text-primary-foreground">
      {/* Decorative grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      <div className="container-marketing relative py-20 md:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3 w-3" aria-hidden />
              <span>Built for European study destinations</span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Study in Europe.
              <br />
              <span className="text-accent-300">Start Your Future.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
              From choosing the right European university to preparing your application and visa,
              Euroscope helps students manage their entire journey from one place.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/contact">
                <Button size="lg" className="bg-accent-500 text-accent-900 hover:bg-accent-400">
                  Start Your Journey
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <Link href="/study-in-europe">
                <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                  Explore Europe
                </Button>
              </Link>
              <Link href="/contact" className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground link-underline">
                Book a Free Consultation
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/15 pt-6 text-primary-foreground/80">
              <div>
                <dt className="text-xs uppercase tracking-wide text-primary-foreground/60">European destinations</dt>
                <dd className="mt-1 text-2xl font-semibold">8+</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-primary-foreground/60">Journey stages</dt>
                <dd className="mt-1 text-2xl font-semibold">18</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-primary-foreground/60">Platform roles</dt>
                <dd className="mt-1 text-2xl font-semibold">3</dd>
              </div>
            </dl>
          </div>

          {/* Product UI mockup — represents actual Euroscope interface */}
          <div className="relative hidden lg:block">
            <ProductMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductMockup() {
  return (
    <div className="relative rounded-xl border border-white/20 bg-card/95 text-card-foreground shadow-2xl backdrop-blur">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" aria-hidden />
        <span className="ml-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Compass className="h-3 w-3" aria-hidden />
          euroscope.app/student/dashboard
        </span>
      </div>

      {/* Mock dashboard */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Good morning,</p>
            <p className="text-lg font-semibold">Karim Ahmed</p>
            <p className="text-xs text-muted-foreground">STD-2026-000001 · Germany</p>
          </div>
          <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            In progress
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Application progress</span>
            <span className="font-semibold text-foreground">62%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[62%] rounded-full bg-primary" />
          </div>
        </div>

        {/* Mini timeline */}
        <div className="mt-5 space-y-2">
          {[
            { label: "Lead captured", done: true },
            { label: "Counselling completed", done: true },
            { label: "University selected", done: true },
            { label: "Application submitted", done: false },
            { label: "Visa preparation", done: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span
                className={
                  step.done
                    ? "grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
                    : "grid h-5 w-5 place-items-center rounded-full border border-border text-muted-foreground"
                }
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Documents</p>
            <p className="text-sm font-semibold">8 / 12</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Tasks</p>
            <p className="text-sm font-semibold">3</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Deadlines</p>
            <p className="text-sm font-semibold text-warning">2</p>
          </div>
        </div>
      </div>
    </div>
  );
}
