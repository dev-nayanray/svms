import Link from "next/link";
import { Compass, Mail } from "lucide-react";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/constants/app";
import { SUPPORTED_DESTINATIONS } from "@/lib/constants/app";

const PLATFORM_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/login", label: "Student Portal" },
  { href: "/login", label: "Employee Portal" },
  { href: "/login", label: "Admin Platform" },
];

const RESOURCE_LINKS = [
  { href: "/resources", label: "Guides" },
  { href: "/contact", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];

const COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container-marketing py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 font-semibold" aria-label={`${APP_NAME} home`}>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
                <Compass className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-base tracking-tight">{APP_NAME}</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground text-pretty">
              The complete platform for students planning to study in Europe — from university discovery to visa preparation, all in one place.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-4 w-4" aria-hidden />
              {SUPPORT_EMAIL}
            </a>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Study in Europe</h3>
            <ul className="mt-3 space-y-2">
              {SUPPORTED_DESTINATIONS.slice(0, 8).map((d) => (
                <li key={d.code}>
                  <Link
                    href={`/study-in-europe?country=${d.code}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {d.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Platform</h3>
            <ul className="mt-3 space-y-2">
              {PLATFORM_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Company</h3>
            <ul className="mt-3 space-y-2">
              {COMPANY_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
              {RESOURCE_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <Link href="/about" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/about" className="hover:text-foreground">Terms</Link>
            <Link href="/about" className="hover:text-foreground">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
