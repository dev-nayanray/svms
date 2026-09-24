import { UserRound, Briefcase, Settings } from "lucide-react";

const ROLES = [
  {
    icon: UserRound,
    eyebrow: "For students",
    title: "Everything you need for your European study journey",
    description:
      "Track your application progress, manage documents, prepare for your visa, message your counselor, and never miss a deadline — all from one mobile-friendly dashboard.",
    features: [
      "Application tracking with stage-by-stage progress",
      "Document checklist with status indicators",
      "University and course information",
      "Visa preparation workflow",
      "Payment and invoice history",
      "Direct messaging with your counselor",
      "Real-time notifications",
    ],
    cta: { label: "Start Your Journey", href: "/contact" },
    accent: "primary" as const,
  },
  {
    icon: Briefcase,
    eyebrow: "For employees",
    title: "Manage every student journey with clarity",
    description:
      "A modern CRM built for education counselors — see your assigned students, applications, documents, tasks, visa cases, and appointments in one organized workspace.",
    features: [
      "Assigned students with profile overview",
      "Application pipeline with stage tracking",
      "Document review workflow",
      "Task management with priorities",
      "Visa case management",
      "Appointment scheduling",
      "Performance insights",
    ],
    cta: { label: "Employee Portal", href: "/login" },
    accent: "accent" as const,
  },
  {
    icon: Settings,
    eyebrow: "For administrators",
    title: "Run your education operation from one platform",
    description:
      "Full visibility across students, employees, branches, applications, finance, and reports — with granular permissions, audit logging, and system settings.",
    features: [
      "Student and employee management",
      "Multi-branch support",
      "Application oversight",
      "Finance and invoice controls",
      "Reports and analytics",
      "Roles and permissions",
      "Audit logs and system settings",
    ],
    cta: { label: "Admin Platform", href: "/login" },
    accent: "brand" as const,
  },
];

export function RoleExperience() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Role-based experience
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            One platform, three perspectives
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">
            Euroscope adapts to your role — students, counselors, and administrators each get a
            workspace shaped around their needs.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          {ROLES.map((role, i) => (
            <div
              key={role.eyebrow}
              className={`grid gap-8 lg:grid-cols-2 lg:items-center ${
                i % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""
              }`}
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  {role.eyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
                  {role.title}
                </h3>
                <p className="mt-3 text-base text-muted-foreground text-pretty">
                  {role.description}
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {role.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Product UI mockup */}
              <div className="card-elevated overflow-hidden p-5">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <role.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{role.eyebrow.replace(/^For /, "")} workspace</p>
                    <p className="text-xs text-muted-foreground">Euroscope product preview</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex items-center gap-3 rounded-md border border-border p-2.5">
                      <span className="h-7 w-7 rounded-full bg-muted" aria-hidden />
                      <div className="flex-1">
                        <div className="h-2.5 w-2/3 rounded bg-muted" aria-hidden />
                        <div className="mt-1.5 h-2 w-1/3 rounded bg-muted/70" aria-hidden />
                      </div>
                      <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
