import { BookOpen, ClipboardList, FileQuestion, FileText, CalendarClock, MessageSquareWarning, Layers } from "lucide-react";

const PROBLEMS = [
  {
    icon: BookOpen,
    title: "Too Much Information",
    description: "Finding reliable university and course information across multiple European countries can be overwhelming.",
  },
  {
    icon: ClipboardList,
    title: "Complicated Applications",
    description: "Different universities have different requirements, deadlines, and application portals.",
  },
  {
    icon: FileQuestion,
    title: "Document Confusion",
    description: "Students often struggle to track which documents are required, expired, or already submitted.",
  },
  {
    icon: FileText,
    title: "Visa Preparation",
    description: "Visa preparation requires careful planning, biometrics, interviews, and timely documentation.",
  },
  {
    icon: CalendarClock,
    title: "Missed Deadlines",
    description: "Multiple university and visa deadlines across countries can be difficult to manage.",
  },
  {
    icon: MessageSquareWarning,
    title: "Poor Communication",
    description: "Students may not know the current status of their application or what to do next.",
  },
  {
    icon: Layers,
    title: "Scattered Information",
    description: "Documents, payments, applications, and messages often live across multiple disconnected platforms.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            The challenge
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Studying in Europe shouldn't be this complicated
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">
            Every year, thousands of students dream of studying in Europe — but the journey from
            interest to arrival is full of friction. Here are the most common pain points students face.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="card-elevated p-5">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-warning/10 text-warning">
                <p.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-base font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
