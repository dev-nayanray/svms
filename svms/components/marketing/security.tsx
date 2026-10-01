import { ShieldCheck, KeyRound, FileLock2, History, Eye } from "lucide-react";

const TRUST_PILLARS = [
  {
    icon: KeyRound,
    title: "Secure authentication",
    description: "Bcrypt-hashed passwords, JWT sessions, and credentials that never travel in plain text.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description: "Granular permissions for Admin, Employee, and Student roles — every route + API is guarded.",
  },
  {
    icon: FileLock2,
    title: "Private document access",
    description: "Documents are scoped per student; employees only see records they are assigned to.",
  },
  {
    icon: History,
    title: "Audit logging",
    description: "Sensitive changes — status, assignments, document reviews — are audit-logged for accountability.",
  },
  {
    icon: Eye,
    title: "Case ownership",
    description: "Employees only access students, leads, and tasks assigned to them. No IDOR — identity is always resolved from the session.",
  },
];

export function SecuritySection() {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Trust & security
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Built with privacy and accountability at the core
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">
            Euroscope is designed around real security practices — not marketing buzzwords. Here
            are the capabilities that ship with the platform today.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_PILLARS.map((p) => (
            <div key={p.title} className="card-elevated p-5">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-success/10 text-success">
                <p.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-base font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{p.description}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Euroscope does not currently hold third-party security certifications. We do not guarantee visa approvals or claim specific success rates.
        </p>
      </div>
    </section>
  );
}
