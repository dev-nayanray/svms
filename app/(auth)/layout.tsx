import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui";
import {
  GraduationCap, MapPin, FileCheck, Plane, Users, ShieldCheck,
  ArrowRight, Star,
} from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — branding + content (hidden on mobile) ── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-10 text-white xl:flex">
        {/* Decorative pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />

        {/* Glowing orb effect */}
        <div
          className="absolute -right-20 top-1/4 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -left-10 bottom-1/4 h-48 w-48 rounded-full bg-accent-500/10 blur-3xl"
          aria-hidden
        />

        {/* ── Top: Logo ── */}
        <Link href="/" className="relative flex items-center gap-3">
          <span className="relative h-10 w-10 overflow-hidden rounded-lg bg-white/10 backdrop-blur">
            <Image
              src="/euroscope-mark.png"
              alt="Euroscope"
              fill
              sizes="40px"
              className="object-contain p-1.5"
              priority
            />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xl font-bold tracking-tight">Euroscope</span>
            <span className="text-xs text-white/60">Your journey to studying in Europe</span>
          </span>
        </Link>

        {/* ── Middle: Headline + stats + steps ── */}
        <div className="relative space-y-8">
          {/* Headline */}
          <div className="space-y-4">
            <h2 className="font-display text-3xl font-bold leading-tight">
              Study in Europe.<br />
              <span className="text-accent-300">Start Your Future.</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-white/70">
              Euroscope guides students through every step — from choosing the right university
              to preparing your visa application — all in one organized place.
            </p>
          </div>

          {/* Stats row */}
          <div className="flex gap-8">
            <div>
              <p className="font-display text-2xl font-bold">8+</p>
              <p className="text-xs text-white/50">European countries</p>
            </div>
            <div className="border-l border-white/10 pl-8">
              <p className="font-display text-2xl font-bold">500+</p>
              <p className="text-xs text-white/50">Universities</p>
            </div>
            <div className="border-l border-white/10 pl-8">
              <p className="font-display text-2xl font-bold">1000+</p>
              <p className="text-xs text-white/50">Students guided</p>
            </div>
          </div>

          {/* Process steps */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">How it works</p>
            <div className="space-y-2.5">
              {[
                { icon: Users, text: "Free consultation with expert counselors", step: "01" },
                { icon: GraduationCap, text: "Personalized university & course selection", step: "02" },
                { icon: FileCheck, text: "Document guidance & application management", step: "03" },
                { icon: Plane, text: "Visa preparation & travel support", step: "04" },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-white/30">{item.step}</span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10">
                      <item.icon className="h-4 w-4 text-accent-300" />
                    </span>
                  </div>
                  <span className="text-sm text-white/80">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Secure & private
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-info" />
              Germany · France · Italy · Spain · Netherlands
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-accent-300" />
              Trusted by 1000+ students
            </span>
          </div>
        </div>

        {/* ── Bottom: Testimonial + copyright ── */}
        <div className="relative space-y-4">
          {/* Testimonial */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="mb-2 flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-accent-300 text-accent-300" />
              ))}
            </div>
            <p className="text-sm italic leading-relaxed text-white/80">
              &ldquo;Euroscope made my dream of studying in Germany a reality. From university
              selection to visa preparation, they were with me every step.&rdquo;
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-500/20 text-xs font-semibold text-accent-300">
                SA
              </span>
              <div>
                <p className="text-xs font-medium text-white">Sarah Ahmed</p>
                <p className="text-[10px] text-white/50">Now studying at TU Munich</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-white/40">
            <span>© {new Date().getFullYear()} Euroscope. All rights reserved.</span>
            <Link href="/" className="flex items-center gap-1 hover:text-white/70">
              Back to site <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex w-full items-center justify-center p-4 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo (hidden on desktop — desktop shows it on left panel) */}
          <Link href="/" className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="relative h-10 w-10 overflow-hidden rounded-lg">
              <Image
                src="/euroscope-mark.png"
                alt="Euroscope"
                fill
                sizes="40px"
                className="object-contain"
                priority
              />
            </span>
            <span className="font-display text-xl font-bold tracking-tight">Euroscope</span>
          </Link>
          <Card>
            <CardContent className="p-6 sm:p-8">{children}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
