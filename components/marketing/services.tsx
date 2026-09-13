import { ICONS, FaIcon } from "./icons";
import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";
import type { ContentItem } from "@/lib/services/marketing-content";

/* ════════════════════════════════════════════════════════════
 *  SERVICES — dynamic from admin panel
 * ════════════════════════════════════════════════════════════ */

export function ServicesSection({ items }: { items?: ContentItem[] }) {
  const services = items ?? [];
  if (services.length === 0) return null;
  return (
    <Section tone="default" id="services">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">Our Services</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              How we help you study in Europe
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              From your first question to your first day in Europe, our counselors
              provide personalized guidance at every step of the journey.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const icon = ICONS[service.icon as keyof typeof ICONS] ?? ICONS.comments;
            return (
              <MarketingReveal key={i} delay={(i % 3) * 80}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                  <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                    <FaIcon icon={icon} className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="font-display text-xl font-bold tracking-tight">{service.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                </div>
              </MarketingReveal>
            );
          })}
        </div>

        <div className="mt-14 text-center">
          <MarketingButton href="/contact" variant="primary" size="lg">
            Talk to our counselors
            <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  WHY EUROSCOPE — dynamic from admin panel
 * ════════════════════════════════════════════════════════════ */

export function WhyEuroscopeSection({ items }: { items?: ContentItem[] }) {
  const reasons = items ?? [];
  if (reasons.length === 0) return null;
  return (
    <Section tone="muted" id="why">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">Why {APP_NAME}</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              A consultancy that actually cares
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              We&apos;re not a faceless agency or a software platform. We&apos;re
              counselors who care about getting you to Europe the right way.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((reason, i) => {
            const icon = ICONS[reason.icon as keyof typeof ICONS] ?? ICONS.shieldCheck;
            return (
              <MarketingReveal key={i} delay={(i % 3) * 80}>
                <div className="flex h-full gap-4 rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-accent/30">
                  <div className="shrink-0">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/10">
                      <FaIcon icon={icon} className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold tracking-tight">{reason.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{reason.description}</p>
                  </div>
                </div>
              </MarketingReveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  HOW WE HELP — dynamic from admin panel
 * ════════════════════════════════════════════════════════════ */

export function HowWeHelp({ items }: { items?: ContentItem[] }) {
  const steps = items ?? [];
  if (steps.length === 0) return null;
  return (
    <Section tone="default" id="how-we-help">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">How We Help</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              A clear path to Europe
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              We break down the journey into four clear phases — and support you
              through every one.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const icon = ICONS[step.icon as keyof typeof ICONS] ?? ICONS.lightbulb;
            return (
              <MarketingReveal key={i} delay={i * 100}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-5xl font-bold text-primary/15" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                      <FaIcon icon={icon} className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </MarketingReveal>
            );
          })}
        </div>

        <div className="mt-14 text-center">
          <MarketingButton href="/contact" variant="primary" size="lg">
            Book Your Free Consultation
            <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}
