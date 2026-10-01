import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SUPPORTED_DESTINATIONS } from "@/lib/constants/app";

export function DestinationSection() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container-marketing">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            European destinations
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Choose where your European story begins
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">
            Euroscope currently supports these European study destinations. Each country has its own
            application rhythm, visa requirements, and intake calendar — we help you navigate every one.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUPPORTED_DESTINATIONS.map((d) => (
            <Link
              key={d.code}
              href={`/study-in-europe?country=${d.code}`}
              className="card-elevated group block p-5 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden>
                  {d.flag}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
              </div>
              <h3 className="mt-3 text-base font-semibold">{d.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {d.popular.join(" · ")}
              </p>
              <p className="mt-3 text-xs font-medium text-primary group-hover:link-underline">
                Explore {d.name} →
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/study-in-europe"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:link-underline"
          >
            View all destinations <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
