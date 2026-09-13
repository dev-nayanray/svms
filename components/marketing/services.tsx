import { ICONS, FaIcon } from "./icons";
import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";

/* ════════════════════════════════════════════════════════════
 *  SERVICES — what the company offers (FA icons, not emojis)
 * ════════════════════════════════════════════════════════════ */

const SERVICES = [
  { icon: ICONS.comments, title: "Personal Counselling", body: "One-on-one sessions with experienced counselors who understand European education. We assess your profile, goals and budget — then recommend the right path." },
  { icon: ICONS.graduationCap, title: "University Selection", body: "We help you choose the right European university based on your academic background, career goals and financial situation — not just rankings." },
  { icon: ICONS.clipboardCheck, title: "Application Management", body: "We handle your university applications end-to-end — forms, documents, deadlines and follow-ups — so nothing falls through the cracks." },
  { icon: ICONS.fileLines, title: "Document Guidance", body: "We guide you through every document — transcripts, motivation letters, recommendations, financial proof — and review each one before submission." },
  { icon: ICONS.planeDeparture, title: "Visa Preparation", body: "We prepare your visa application with country-specific checklists, financial documentation guidance and interview coaching — every step of the way." },
  { icon: ICONS.envelope, title: "Travel & Arrival Support", body: "We help with pre-departure preparation — accommodation guidance, travel planning and what to expect when you arrive in Europe." },
];

export function ServicesSection() {
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
          {SERVICES.map((service, i) => (
            <MarketingReveal key={service.title} delay={(i % 3) * 80}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                <div
                  className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                />
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                  <FaIcon icon={service.icon} className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="font-display text-xl font-bold tracking-tight">{service.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{service.body}</p>
              </div>
            </MarketingReveal>
          ))}
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
 *  WHY EUROSCOPE — company differentiators (FA icons)
 * ════════════════════════════════════════════════════════════ */

const REASONS = [
  { icon: ICONS.earthEurope, title: "European Focus", body: "We specialize in European education. Our counselors understand the nuances of each country's university system, visa process and culture." },
  { icon: ICONS.users, title: "Personal Counselors", body: "You work with a dedicated counselor who knows your case — not a call center. One person, one relationship, end-to-end support." },
  { icon: ICONS.handshake, title: "End-to-End Support", body: "We don't just submit forms and disappear. We walk with you from the first consultation to your arrival in Europe." },
  { icon: ICONS.eye, title: "Transparent Process", body: "You see every step of your application — what's done, what's pending, what's next. No black boxes, no surprises." },
  { icon: ICONS.clock, title: "Deadline Management", body: "Multiple university intakes, visa appointments and document deadlines — we track them all so you never miss a date." },
  { icon: ICONS.shieldCheck, title: "Honest Guidance", body: "We don't make promises we can't keep. No guaranteed visas, no fake success rates — just honest, expert advice." },
];

export function WhyEuroscopeSection() {
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
          {REASONS.map((reason, i) => (
            <MarketingReveal key={reason.title} delay={(i % 3) * 80}>
              <div className="flex h-full gap-4 rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-accent/30">
                <div className="shrink-0">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/10">
                    <FaIcon icon={reason.icon} className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold tracking-tight">{reason.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{reason.body}</p>
                </div>
              </div>
            </MarketingReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  HOW WE HELP — 4 steps (FA icons)
 * ════════════════════════════════════════════════════════════ */

const HELP_STEPS = [
  { num: "01", icon: ICONS.lightbulb, title: "Free Consultation", body: "We start with a free, no-obligation consultation. Tell us about your goals, background and budget — we'll tell you if Europe is right for you." },
  { num: "02", icon: ICONS.route, title: "Personalized Plan", body: "Your counselor creates a personalized roadmap — target countries, universities, courses, timeline and document checklist — based on your profile." },
  { num: "03", icon: ICONS.peopleArrows, title: "Application Support", body: "We handle your applications — forms, documents, deadlines, follow-ups. You see every step, we handle the heavy lifting." },
  { num: "04", icon: ICONS.plane, title: "Visa & Travel", body: "Once you have your offer, we guide you through visa preparation, interviews and travel planning — right up to your arrival in Europe." },
];

export function HowWeHelp() {
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
          {HELP_STEPS.map((step, i) => (
            <MarketingReveal key={step.num} delay={i * 100}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-display text-5xl font-bold text-primary/15" aria-hidden>
                    {step.num}
                  </span>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                    <FaIcon icon={step.icon} className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </MarketingReveal>
          ))}
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
