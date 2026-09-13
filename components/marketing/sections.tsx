import { ICONS, FaIcon } from "./icons";
import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";
import { Check } from "lucide-react";

/* ════════════════════════════════════════════════════════════
 *  PROBLEM SECTION — FA icons
 * ════════════════════════════════════════════════════════════ */

const PROBLEMS = [
  { icon: ICONS.fileQuestion, title: "Too Much Information", body: "Finding reliable university and course information across hundreds of European institutions can be overwhelming." },
  { icon: ICONS.layerGroup, title: "Complicated Applications", body: "Different universities have different requirements, deadlines and application portals — easy to miss something." },
  { icon: ICONS.triangleWarning, title: "Document Confusion", body: "Students often struggle to track which documents are required, which are approved, and which need re-submission." },
  { icon: ICONS.passport, title: "Visa Preparation", body: "Visa preparation requires careful planning, financial proof and timely documentation — with high stakes." },
  { icon: ICONS.calendarXmark, title: "Missed Deadlines", body: "Multiple university intakes, visa appointments and document deadlines can be difficult to manage together." },
  { icon: ICONS.poorCommunication, title: "Poor Communication", body: "Students may not know the current status of their application — left waiting without updates for weeks." },
];

export function ProblemSection() {
  return (
    <Section tone="muted">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">The Challenge</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              The European study journey is complex
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              Students come to us when the journey feels overwhelming. Here&apos;s
              what we help them navigate.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <MarketingReveal key={p.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/10">
                  <FaIcon icon={p.icon} className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="font-display text-xl font-bold tracking-tight">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            </MarketingReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  SOLUTION SECTION
 * ════════════════════════════════════════════════════════════ */

export function SolutionSection() {
  return (
    <Section tone="default">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">How We Work</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Personal guidance, organized process
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              We combine personal counseling with a clear, organized process —
              so you always know where you are and what&apos;s next.
            </p>
          </MarketingReveal>
        </div>

        <MarketingReveal delay={240}>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Personal counselor for every student",
              "Application tracking from start to finish",
              "Document guidance with review and feedback",
              "Visa preparation with country-specific checklists",
              "Direct messaging with your counselor",
              "Transparent financial tracking and invoices",
              "Real-time updates on your application status",
              "Live progress timeline you can check anytime",
              "Secure access for students, counselors and admins",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </MarketingReveal>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  JOURNEY TIMELINE — FA icons (replaced all emojis)
 * ════════════════════════════════════════════════════════════ */

const JOURNEY_STEPS = [
  { label: "Lead", icon: ICONS.lead, phase: "Start" },
  { label: "Counselling", icon: ICONS.counselling, phase: "Start" },
  { label: "Registration", icon: ICONS.registration, phase: "Start" },
  { label: "Profile Assessment", icon: ICONS.profileAssessment, phase: "Start" },
  { label: "Country Selection", icon: ICONS.countrySelection, phase: "Plan" },
  { label: "University Selection", icon: ICONS.universitySelection, phase: "Plan" },
  { label: "Course Selection", icon: ICONS.courseSelection, phase: "Plan" },
  { label: "Document Collection", icon: ICONS.documentCollection, phase: "Plan" },
  { label: "University Application", icon: ICONS.universityApplication, phase: "Apply" },
  { label: "Offer Letter", icon: ICONS.offerLetter, phase: "Apply" },
  { label: "Deposit", icon: ICONS.deposit, phase: "Apply" },
  { label: "Visa Preparation", icon: ICONS.visaPreparation, phase: "Visa" },
  { label: "Visa Submission", icon: ICONS.visaSubmission, phase: "Visa" },
  { label: "Biometrics", icon: ICONS.biometrics, phase: "Visa" },
  { label: "Interview", icon: ICONS.interview, phase: "Visa" },
  { label: "Visa Decision", icon: ICONS.visaDecision, phase: "Visa" },
  { label: "Travel Preparation", icon: ICONS.travelPreparation, phase: "Travel" },
  { label: "Europe", icon: ICONS.europe, phase: "Travel" },
];

const PHASE_COLORS: Record<string, string> = {
  Start: "border-sky-400/40 bg-sky-400/5",
  Plan: "border-violet-400/40 bg-violet-400/5",
  Apply: "border-amber-400/40 bg-amber-400/5",
  Visa: "border-rose-400/40 bg-rose-400/5",
  Travel: "border-emerald-400/40 bg-emerald-400/5",
};

export function JourneyTimeline() {
  return (
    <Section tone="dark" className="relative overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <div
          className="absolute -top-40 left-1/4 h-[500px] w-[600px] rounded-full opacity-25 blur-[120px]"
          style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 65%)" }}
        />
        <div
          className="absolute -bottom-40 right-1/4 h-[400px] w-[500px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />
        <div className="absolute inset-0 euroscope-grid-bg opacity-20" />
      </div>
      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow tone="accent" className="justify-center">The Complete Journey</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              From lead to Europe — every step managed
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-5 text-base leading-relaxed text-white/70 md:text-lg">
              {APP_NAME} is built around the European student journey — every stage,
              from the first counselling session to landing in Europe.
            </p>
          </MarketingReveal>
        </div>

        <MarketingReveal delay={240}>
          <ol className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {JOURNEY_STEPS.map((step, i) => (
              <li
                key={step.label}
                className={`group relative rounded-xl border p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${PHASE_COLORS[step.phase]}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                    {step.phase}
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-2.5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110">
                    <FaIcon icon={step.icon} className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-white">{step.label}</span>
                </div>
              </li>
            ))}
          </ol>
        </MarketingReveal>

        <div className="mt-14 text-center">
          <MarketingButton href="/how-it-works" variant="primary" size="lg">
            See how it works
            <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  HOW IT WORKS — 4 simple steps (legacy, kept for backwards compat)
 * ════════════════════════════════════════════════════════════ */

const HOW_IT_WORKS_STEPS = [
  { num: "01", title: "Discover", body: "Find suitable European study opportunities — universities, courses and admission requirements." },
  { num: "02", title: "Plan", body: "Choose your university, course and application strategy with your counselor." },
  { num: "03", title: "Apply", body: "Manage documents, applications and offer letters — all tracked in one place." },
  { num: "04", title: "Prepare", body: "Complete visa preparation and get ready for your European journey." },
];

export function HowItWorks() {
  return (
    <Section tone="muted">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">How It Works</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Four simple steps to Europe
            </h2>
          </MarketingReveal>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <MarketingReveal key={step.num} delay={i * 100}>
              <div className="relative h-full rounded-2xl border border-border bg-card p-6">
                <span className="font-display text-4xl font-bold text-primary/15" aria-hidden>
                  {step.num}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </MarketingReveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <MarketingButton href="/contact" variant="primary" size="lg">
            Start Your Journey
            <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  TRUST & SECURITY — FA icons
 * ════════════════════════════════════════════════════════════ */

const TRUST_ITEMS = [
  { icon: ICONS.lock, title: "Secure Authentication", body: "Password-based login with bcrypt hashing, JWT sessions with periodic DB re-validation, and rate limiting on sensitive endpoints." },
  { icon: ICONS.userShield, title: "Role-Based Access", body: "Three distinct roles — Admin, Employee and Student — each with their own panel, scoped data access and permission matrix." },
  { icon: ICONS.folderLock, title: "Private Document Access", body: "Files stored under private storage (never under /public). Download endpoints verify ownership server-side and stream with no-store cache headers." },
  { icon: ICONS.scroll, title: "Audit Logging", body: "Critical actions — password changes, document uploads, status changes — are recorded with IP, user agent and old/new values for compliance." },
];

export function TrustSection() {
  return (
    <Section tone="default">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">Trust & Security</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Built secure from day one
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              {APP_NAME} is built with security as a foundation — not an afterthought.
              Every student record, document and application is protected.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {TRUST_ITEMS.map((item, i) => (
            <MarketingReveal key={item.title} delay={i * 80}>
              <div className="flex h-full gap-5 rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
                <div className="shrink-0">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                    <FaIcon icon={item.icon} className="h-6 w-6" aria-hidden />
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
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
 *  FINAL CTA
 * ════════════════════════════════════════════════════════════ */

export function CTASection() {
  return (
    <Section tone="dark" className="relative overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <div
          className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
          style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 60%)" }}
        />
        <div
          className="absolute -bottom-20 right-0 h-[400px] w-[400px] rounded-full opacity-20 blur-[100px]"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />
        <div className="absolute inset-0 euroscope-grid-bg opacity-20" />
      </div>
      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <MarketingReveal>
            <Eyebrow tone="accent" className="justify-center">Get Started</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              Your European Future{" "}
              <span className="euroscope-gradient-text">Starts Here.</span>
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              Talk to our counselors and get a personalized plan for your European
              study journey. No pressure, no obligation — just honest guidance.
            </p>
          </MarketingReveal>
          <MarketingReveal delay={240}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <MarketingButton href="/contact" variant="primary" size="lg" className="w-full sm:w-auto">
                Book a Free Consultation
                <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
              </MarketingButton>
              <MarketingButton
                href="/study-in-europe"
                variant="secondary"
                size="lg"
                className="w-full bg-white/10 text-white border-white/20 hover:bg-white/20 sm:w-auto"
              >
                Explore Destinations
              </MarketingButton>
            </div>
          </MarketingReveal>
        </div>
      </Container>
    </Section>
  );
}
