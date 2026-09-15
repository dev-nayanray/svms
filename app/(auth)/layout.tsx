import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-12 text-white lg:flex">
        {/* Decorative pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />

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

        <div className="relative space-y-6">
          <h2 className="font-display text-3xl font-bold leading-tight">
            Study in Europe.<br />Start Your Future.
          </h2>
          <p className="max-w-md text-white/70">
            Euroscope guides students through every step — from choosing the right university
            to preparing your visa application — all in one organized place.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
              Personalized guidance
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
              End-to-end support
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
              European expertise
            </span>
          </div>
        </div>

        <div className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Euroscope. All rights reserved.
        </div>
      </div>

      {/* Right panel — form */}
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
