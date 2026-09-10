import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MobilePage, MobileCard } from "@/components/student/ui";

/**
 * Placeholder screen for student modules that ship in later releases.
 * Keeps navigation, headers, and routing real while content lands module
 * by module.
 */
export function ModulePage({
  title,
  description,
  module,
}: {
  title: string;
  description: string;
  module: string;
}) {
  return (
    <MobilePage>
      <MobileCard className="py-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {module}
        </span>
        <h2 className="mt-3 text-lg font-semibold">{title}</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
        <p className="mt-2 text-xs text-muted-foreground">This module arrives in an upcoming release.</p>
        <Link
          href="/student"
          className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
        </Link>
      </MobileCard>
    </MobilePage>
  );
}
