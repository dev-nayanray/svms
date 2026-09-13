import { Compass, ClipboardCheck, FileText, Plane } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

const STEPS = [
  {
    number: "01",
    icon: Compass,
    title: "Discover",
    description: "Find suitable European study opportunities across our supported destinations.",
  },
  {
    number: "02",
    icon: ClipboardCheck,
    title: "Plan",
    description: "Choose your university, course, and application strategy with your counselor.",
  },
  {
    number: "03",
    icon: FileText,
    title: "Apply",
    description: "Manage documents, applications, and offers — all tracked in one pipeline.",
  },
  {
    number: "04",
    icon: Plane,
    title: "Prepare",
    description: "Complete visa preparation and get ready for your European journey.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Four steps from idea to departure
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">
            Euroscope keeps the process simple — discover, plan, apply, and prepare, all in one place.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.number} className="card-elevated p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-2xl font-bold text-muted-foreground/30">{s.number}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{s.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/contact">
            <Button size="lg">Start Your Journey</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
