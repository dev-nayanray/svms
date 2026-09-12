import {
  AlertTriangle,
  CalendarClock,
  FileQuestion,
  MessagesSquare,
  FolderKanban,
  ShieldCheck,
  Lock,
  Eye,
  ScrollText,
  ArrowRight,
  Check,
} from "lucide-react";
import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";

/* ════════════════════════════════════════════════════════════
 *  PROBLEM SECTION
 * ════════════════════════════════════════════════════════════ */

const PROBLEMS = [
  {
    icon: FileQuestion,
    title: "Too Much Information",
    body: "Finding reliable university and course information across hundreds of European institutions can be overwhelming.",
  },
  {
    icon: FolderKanban,
    title: "Complicated Applications",
    body: "Different universities have different requirements, deadlines and application portals — easy to miss something.",
  },
  {
    icon: AlertTriangle,
    title: "Document Confusion",
    body: "Students often struggle to track which documents are required, which are approved, and which need re-submission.",
  },
  {
    icon: ShieldCheck,
    title: "Visa Preparation",
    body: "Visa preparation requires careful planning, financial proof and timely documentation — with high stakes.",
  },
  {
    icon: CalendarClock,
    title: "Missed Deadlines",
    body: "Multiple university intakes, visa appointments and document deadlines can be difficult to manage together.",
  },
  {
    icon: MessagesSquare,
    title: "Poor Communication",
    body: "Students may not know the current status of their application — left waiting without updates for weeks.",
  },
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
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              The European study journey is complex
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              International students face real challenges when planning European education.
              {APP_NAME} exists to solve them.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <MarketingReveal key={p.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <p.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
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
            <Eyebrow className="justify-center">The Euroscope Solution</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              One journey. One platform.
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {APP_NAME} brings your European study journey together in one organized experience —
              from discovery to visa, all in one place.
            </p>
          </MarketingReveal>
        </div>

        <MarketingReveal delay={240}>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Centralized student management",
              "Application tracking from start to finish",
              "Document organization with version history",
              "Visa workflow with requirements checklist",
              "Team collaboration between students and counselors",
              "Financial visibility with invoices and payments",
              "Real-time messaging between students and staff",
              "Live progress tracking with timeline view",
              "Role-based access for Admin, Employee and Student",
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
 *  JOURNEY TIMELINE — the signature section
 * ════════════════════════════════════════════════════════════ */

const JOURNEY_STEPS = [
  { label: "Lead", icon: "📝" },
  { label: "Counselling", icon: "💬" },
  { label: "Registration", icon: "✏️" },
  { label: "Profile Assessment", icon: "📋" },
  { label: "Country Selection", icon: "🌍" },
  { label: "University Selection", icon: "🏛️" },
  { label: "Course Selection", icon: "📚" },
  { label: "Document Collection", icon: "📁" },
  { label: "University Application", icon: "📤" },
  { label: "Offer Letter", icon: "✉️" },
  { label: "Deposit", icon: "💳" },
  { label: "Visa Preparation", icon: "🛂" },
  { label: "Visa Submission", icon: "📨" },
  { label: "Biometrics", icon: "🔐" },
  { label: "Interview", icon: "🎤" },
  { label: "Visa Decision", icon: "✅" },
  { label: "Travel Preparation", icon: "🧳" },
  { label: "Europe", icon: "🇪🇺" },
];

export function JourneyTimeline() {
  return (
    <Section tone="dark" className="relative overflow-hidden">
      <div className="absolute inset-0 euroscope-grid-bg opacity-30" aria-hidden />
      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow tone="accent" className="justify-center">The Complete Journey</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From lead to Europe — every step managed
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              {APP_NAME} is built around the European student journey — every stage,
              from the first counselling session to landing in Europe.
            </p>
          </MarketingReveal>
        </div>

        {/* Timeline */}
        <MarketingReveal delay={240}>
          <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {JOURNEY_STEPS.map((step, i) => (
              <li
                key={step.label}
                className="relative rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:border-accent/40 hover:bg-white/10"
              >
                <span className="absolute left-4 top-4 text-xs font-mono text-white/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="mt-6 flex items-center gap-2">
                  <span className="text-2xl" aria-hidden>{step.icon}</span>
                  <span className="text-sm font-semibold text-white">{step.label}</span>
                </div>
              </li>
            ))}
          </ol>
        </MarketingReveal>

        <div className="mt-12 text-center">
          <MarketingButton href="/how-it-works" variant="primary" size="lg">
            See how it works
            <ArrowRight className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  HOW IT WORKS — 4 simple steps
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
            <ArrowRight className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  TRUST & SECURITY
 * ════════════════════════════════════════════════════════════ */

const TRUST_ITEMS = [
  {
    icon: Lock,
    title: "Secure Authentication",
    body: "Password-based login with bcrypt hashing, JWT sessions with periodic DB re-validation, and rate limiting on sensitive endpoints.",
  },
  {
    icon: Eye,
    title: "Role-Based Access",
    body: "Three distinct roles — Admin, Employee and Student — each with their own panel, scoped data access and permission matrix.",
  },
  {
    icon: ShieldCheck,
    title: "Private Document Access",
    body: "Files stored under private storage (never under /public). Download endpoints verify ownership server-side and stream with no-store cache headers.",
  },
  {
    icon: ScrollText,
    title: "Audit Logging",
    body: "Critical actions — password changes, document uploads, status changes — are recorded with IP, user agent and old/new values for compliance.",
  },
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
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Built secure from day one
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {APP_NAME} is built with security as a foundation — not an afterthought.
              Every student record, document and application is protected.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {TRUST_ITEMS.map((item, i) => (
            <MarketingReveal key={item.title} delay={i * 80}>
              <div className="flex h-full gap-4 rounded-2xl border border-border bg-card p-6">
                <div className="shrink-0">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
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
      <div
        className="absolute inset-0 opacity-30"
        style={{ background: "radial-gradient(circle at 50% 0%, #1e40af 0%, transparent 60%)" }}
        aria-hidden
      />
      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Your European Future Starts Here.
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={120}>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/70">
              Plan your studies, manage your application and move forward with confidence.
              {APP_NAME} is your complete European study companion.
            </p>
          </MarketingReveal>
          <MarketingReveal delay={200}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <MarketingButton href="/contact" variant="primary" size="lg">
                Start Your Journey
                <ArrowRight className="h-4 w-4" aria-hidden />
              </MarketingButton>
              <MarketingButton href="/contact" variant="secondary" size="lg" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                Book a Consultation
              </MarketingButton>
            </div>
          </MarketingReveal>
        </div>
      </Container>
    </Section>
  );
}
