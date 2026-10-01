import {
  Users, Building2, FileText, ClipboardCheck, Stamp, CheckSquare,
  CreditCard, MessageSquare, BarChart3, ShieldCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Student Management",
    description: "Manage student profiles, academic information, application history, and emergency contacts in one secure record.",
  },
  {
    icon: Building2,
    title: "University & Course Discovery",
    description: "Explore European universities and available study opportunities across eight supported destinations.",
  },
  {
    icon: ClipboardCheck,
    title: "Application Management",
    description: "Track applications from submission through to final decision, with a clear stage-by-stage pipeline.",
  },
  {
    icon: FileText,
    title: "Document Management",
    description: "Upload, organize, review, and track required documents — with status flags and audit trail.",
  },
  {
    icon: Stamp,
    title: "Visa Management",
    description: "Manage visa preparation, requirements, appointments, biometrics, and decision tracking.",
  },
  {
    icon: CheckSquare,
    title: "Tasks & Deadlines",
    description: "Never lose track of important university and visa deadlines. Tasks are scoped per student and per application.",
  },
  {
    icon: CreditCard,
    title: "Payments & Invoices",
    description: "Track service payments, invoices, and financial information with role-based access control.",
  },
  {
    icon: MessageSquare,
    title: "Communication",
    description: "Keep students and employees connected with role-aware messaging and notifications.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Monitor applications, students, visas, and business performance across branches.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Secure, granular permissions for Admin, Employee, and Student roles — every action is audit-logged.",
  },
];

export function FeatureGrid() {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Core features
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Everything your European journey needs
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">
            A complete platform built around the realities of European university admissions and visa preparation.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-elevated p-5">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
