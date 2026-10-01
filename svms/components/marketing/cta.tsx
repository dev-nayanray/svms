import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-brand-gradient py-20 text-primary-foreground md:py-28">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />
      <div className="container-marketing relative text-center">
        <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          Your European future starts here.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/80 text-pretty sm:text-lg">
          Plan your studies, manage your application, and move forward with confidence.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/contact">
            <Button size="lg" className="bg-accent-500 text-accent-900 hover:bg-accent-400">
              Start Your Journey
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
          <Link href="/contact">
            <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              Book a Consultation
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
