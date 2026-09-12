import Link from "next/link";
import { EuroscopeLogo } from "./logo";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/constants/app";

const FOOTER_LINKS = {
  "Study in Europe": [
    { href: "/study-in-europe/germany", label: "Germany" },
    { href: "/study-in-europe/france", label: "France" },
    { href: "/study-in-europe/italy", label: "Italy" },
    { href: "/study-in-europe/spain", label: "Spain" },
    { href: "/study-in-europe/netherlands", label: "Netherlands" },
    { href: "/study-in-europe/ireland", label: "Ireland" },
    { href: "/study-in-europe/sweden", label: "Sweden" },
    { href: "/study-in-europe/finland", label: "Finland" },
  ],
  Platform: [
    { href: "/features", label: "Features" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/student", label: "Student Portal" },
    { href: "/employee", label: "Employee Portal" },
    { href: "/admin", label: "Admin Platform" },
  ],
  Resources: [
    { href: "/universities", label: "Universities" },
    { href: "/courses", label: "Courses" },
    { href: "/resources#faq", label: "FAQs" },
    { href: "/contact", label: "Contact" },
  ],
  Company: [
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/about#privacy", label: "Privacy Policy" },
    { href: "/about#terms", label: "Terms" },
  ],
} as const;

export function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-ink text-white">
      {/* Background glow */}
      <div
        className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full opacity-10 blur-[120px]"
        style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 70%)" }}
        aria-hidden
      />
      <div className="euroscope-container relative py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand column */}
          <div className="lg:col-span-4">
            <EuroscopeLogo variant="light" size="lg" showWordmark={false} />
            <EuroscopeLogo variant="light" size="default" className="mt-4" showWordmark={true} />
            <p className="mt-4 font-display text-sm font-semibold text-accent">{APP_TAGLINE}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{APP_DESCRIPTION}</p>
          </div>

          {/* Link columns */}
          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8" aria-label="Footer">
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">
                  {heading}
                </h2>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-white/70 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <p className="text-xs text-white/40">
            Built for students on the European journey.
          </p>
        </div>
      </div>
    </footer>
  );
}
