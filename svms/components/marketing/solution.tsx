import Link from "next/link";
import { ArrowRight, Route } from "lucide-react";
import { Button } from "@/components/ui";

const JOURNEY_STAGES = [
  "Discover", "Counselling", "University", "Course", "Application",
  "Documents", "Offer", "Visa", "Travel",
];

export function SolutionSection() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            The Euroscope solution
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            One journey. One platform.
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">
            Euroscope brings your European study journey together in one organized experience —
            from discovery to departure.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto pb-4">
          <div className="mx-auto flex min-w-max items-center gap-2 px-4">
            {JOURNEY_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-2">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-xs font-medium">{stage}</span>
                </div>
                {i < JOURNEY_STAGES.length - 1 && (
                  <div className="h-0.5 w-12 bg-border" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="text-base text-muted-foreground text-pretty">
            From your first conversation with a counselor to landing in your European city,
            Euroscope keeps every step connected. No more switching between email, spreadsheets,
            and chat apps — your entire journey lives in one platform.
          </p>
          <div className="mt-6">
            <Link href="/how-it-works">
              <Button size="lg">
                <Route className="h-4 w-4" aria-hidden /> See the full journey
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
