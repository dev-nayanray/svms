import { ICONS, type FaIconType } from "./icons";
import { Container, Section, Eyebrow, MarketingButton } from "./ui";
import { MarketingReveal } from "./reveal";
import { APP_NAME } from "@/lib/constants/app";
import { FaIcon } from "./icons";

// Lightweight local FeatureCard that accepts a Font Awesome icon
// (the shared FeatureCard in ui.tsx expects a LucideIcon, which we're
// phasing out in favor of FA icons per the user's request).
function FeatureCard({
  icon,
  title,
  children,
  className,
}: {
  icon: FaIconType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 ${className ?? ""}`}
    >
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
        <FaIcon icon={icon} className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
 *  FEATURE GRID
 * ════════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: ICONS.clipboardCheck,
    title: "Student Management",
    body: "Manage student profiles, academic information, English proficiency and application history — all in one organized record.",
  },
  {
    icon: ICONS.graduationCap,
    title: "University & Course Discovery",
    body: "Browse European universities and available courses. Filter by country, level, tuition fees and language requirements.",
  },
  {
    icon: ICONS.clipboardCheck,
    title: "Application Management",
    body: "Track applications from submission to final decision. Each stage of the journey is logged with timestamps and notes.",
  },
  {
    icon: ICONS.fileLines,
    title: "Document Management",
    body: "Upload, organize, review and track required documents. Version history preserves replaced files for audit trails.",
  },
  {
    icon: ICONS.envelope,
    title: "Offer Management",
    body: "Track conditional and unconditional offer letters. Students see offer status in their dashboard, counselors manage in their panel.",
  },
  {
    icon: ICONS.planeDeparture,
    title: "Visa Management",
    body: "Manage visa preparation, requirements checklists, appointments and progress. Country-specific visa requirements supported.",
  },
  {
    icon: ICONS.clock,
    title: "Tasks & Deadlines",
    body: "Never lose track of important application deadlines. Task lists with priority, due dates and overdue indicators.",
  },
  {
    icon: ICONS.deposit,
    title: "Payments & Invoices",
    body: "Track service payments, issue invoices and monitor financial status. Students see their balance, admins see the big picture.",
  },
  {
    icon: ICONS.comments,
    title: "Communication",
    body: "Keep students and employees connected with real-time messaging. Conversation-scoped, unread badges, and instant notifications.",
  },
  {
    icon: ICONS.scroll,
    title: "Reports & Analytics",
    body: "Monitor applications, students, visas and business performance with dashboard analytics and exportable reports.",
  },
  {
    icon: ICONS.shieldCheck,
    title: "Role-Based Access",
    body: "Secure access for Admin, Employees and Students — each role sees only what they need, with full audit logging.",
  },
  {
    icon: ICONS.sparkles,
    title: "Real-Time Notifications",
    body: "Live updates via Server-Sent Events — new messages, document reviews and appointment changes arrive instantly.",
  },
];

export function FeatureGrid() {
  return (
    <Section tone="default" id="features">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">Platform Features</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your European journey needs
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              A complete platform covering every stage of the student journey —
              from discovery to arrival in Europe.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <MarketingReveal key={f.title} delay={(i % 3) * 80}>
              <FeatureCard icon={f.icon} title={f.title}>
                {f.body}
              </FeatureCard>
            </MarketingReveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <MarketingButton href="/features" variant="outline" size="lg">
            Explore all features
          </MarketingButton>
        </div>
      </Container>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
 *  PRODUCT SHOWCASE — three role-based experiences
 * ════════════════════════════════════════════════════════════ */

export function ProductShowcase() {
  return (
    <Section tone="muted" id="showcase">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingReveal>
            <Eyebrow className="justify-center">Built for everyone</Eyebrow>
          </MarketingReveal>
          <MarketingReveal delay={80}>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              One platform, three experiences
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={160}>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {APP_NAME} serves students, education employees and administrators —
              each with a focused, role-based experience.
            </p>
          </MarketingReveal>
        </div>

        <div className="mt-12 space-y-8 lg:space-y-12">
          <ShowcaseRow
            tone="primary"
            role="For Students"
            tagline="Everything you need for your European study journey."
            features={[
              "Application tracking with live pipeline",
              "Document checklist with version history",
              "Visa progress with requirements",
              "Task deadlines and reminders",
              "Payments and invoices",
              "Real-time messages with your counselor",
              "Live notifications",
            ]}
            mockup={<StudentMockup />}
          />

          <ShowcaseRow
            tone="accent"
            role="For Education Employees"
            tagline="Manage every student journey with clarity."
            features={[
              "Assigned students dashboard",
              "Application management",
              "Document review and approval",
              "Task assignment and tracking",
              "Visa case management",
              "Appointment scheduling",
              "Performance analytics",
            ]}
            mockup={<EmployeeMockup />}
            reverse
          />

          <ShowcaseRow
            tone="primary"
            role="For Administrators"
            tagline="Run your education operation from one platform."
            features={[
              "Business dashboard with KPIs",
              "Student and employee management",
              "Branch management",
              "Application oversight",
              "Finance and invoices",
              "Reports and analytics",
              "Roles and permissions",
              "Audit logs",
            ]}
            mockup={<AdminMockup />}
          />
        </div>
      </Container>
    </Section>
  );
}

function ShowcaseRow({
  role,
  tagline,
  features,
  mockup,
  tone = "primary",
  reverse = false,
}: {
  role: string;
  tagline: string;
  features: string[];
  mockup: React.ReactNode;
  tone?: "primary" | "accent";
  reverse?: boolean;
}) {
  const accentColor = tone === "primary" ? "text-primary" : "text-accent";
  return (
    <MarketingReveal>
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className={reverse ? "lg:order-2" : ""}>
          <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${accentColor}`}>
            {role}
          </span>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {tagline}
          </h3>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "primary" ? "bg-primary" : "bg-accent"}`} aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className={reverse ? "lg:order-1" : ""}>{mockup}</div>
      </div>
    </MarketingReveal>
  );
}

/* ── Product UI mockups ─────────────────────────────────── */

function StudentMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
        Student Dashboard
      </div>
      <div className="p-5">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground">Welcome back, Ayesha</p>
          <p className="font-display text-lg font-bold">Your application is at stage 6 of 12</p>
        </div>
        <div className="space-y-3">
          {[
            { label: "Documents", value: "7 / 9", progress: "78%", color: "bg-success" },
            { label: "Visa Preparation", value: "In progress", progress: "40%", color: "bg-primary" },
            { label: "Tasks", value: "3 active", progress: "60%", color: "bg-accent" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{item.value}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted">
                <div className={`h-1.5 rounded-full ${item.color}`} style={{ width: item.progress }} aria-hidden />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmployeeMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
        Employee Panel — Assigned Students
      </div>
      <div className="p-5">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "Active", value: "12" },
            { label: "Pending", value: "3" },
            { label: "Completed", value: "8" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-2.5 text-center">
              <p className="font-display text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {[
            { name: "Ayesha Rahman", stage: "Application Submitted", color: "bg-primary" },
            { name: "Tanvir Hossain", stage: "Conditional Offer", color: "bg-accent" },
            { name: "Nusrat Jahan", stage: "Visa Submitted", color: "bg-success" },
          ].map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-md border border-border p-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${s.color}`} aria-hidden />
                <span className="text-sm font-medium">{s.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{s.stage}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
        Admin Dashboard — Business Overview
      </div>
      <div className="p-5">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Students", value: "248" },
            { label: "Applications", value: "312" },
            { label: "Visas", value: "89" },
            { label: "Revenue", value: "€42k" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-3">
              <p className="font-display text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        {/* Mini bar chart */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Applications by stage</p>
          <div className="flex h-20 items-end gap-1.5">
            {[40, 65, 80, 55, 70, 90, 45, 30, 20, 15, 10, 25].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-primary/80"
                style={{ height: `${h}%` }}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
