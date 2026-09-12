import Link from "next/link";
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
    <footer className="border-t border-border bg-ink text-white">
      <div className="euroscope-container py-14">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand column */}
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                  <path d="M4 14c4-6 12-6 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path
                    d="M12 4l1.2 3.6h3.8l-3.1 2.3 1.2 3.6-3.1-2.3-3.1 2.3 1.2-3.6-3.1-2.3h3.8z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="font-display text-lg font-bold">{APP_NAME}</span>
            </Link>
            <p className="mt-1 font-display text-sm font-semibold text-accent">{APP_TAGLINE}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{APP_DESCRIPTION}</p>
          </div>

          {/* Link columns */}
          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8" aria-label="Footer">
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">
                  {heading}
                </h2>
                <ul className="mt-4 space-y-2.5">
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

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
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
