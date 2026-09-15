import Link from "next/link";
import { EuroscopeLogo } from "./logo";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/constants/app";
import { ICONS, FaIcon } from "./icons";
import { Container } from "./ui";

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
    <footer className="relative overflow-hidden text-white" style={{ background: "linear-gradient(180deg, #0f172a 0%, #0a0f1e 100%)" }}>
      {/* Background glow */}
      <div
        className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full opacity-10 blur-[120px]"
        style={{ background: "radial-gradient(circle, #1e40af 0%, transparent 70%)" }}
        aria-hidden
      />
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
        aria-hidden
      />

      <Container className="relative py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand column */}
          <div className="lg:col-span-4">
            <EuroscopeLogo variant="markLight" size="lg" showWordmark={true} />
            <p className="mt-4 text-sm font-semibold" style={{ color: "#d4af37" }}>{APP_TAGLINE}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{APP_DESCRIPTION}</p>

            {/* Social proof badges */}
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                <FaIcon icon={ICONS.shieldCheck} className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
                <span className="text-[10px] font-medium text-white/60">Secure Platform</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                <FaIcon icon={ICONS.star} className="h-3.5 w-3.5" style={{ color: "#d4af37" }} />
                <span className="text-[10px] font-medium text-white/60">1000+ Students</span>
              </div>
            </div>
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

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs text-white/40">
              Built for students on the European journey.
            </p>
            <div className="flex items-center gap-3">
              {/* Facebook */}
              <a href="#" aria-label="Facebook" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:border-white/30 hover:text-white">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              {/* Instagram */}
              <a href="#" aria-label="Instagram" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:border-white/30 hover:text-white">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              {/* LinkedIn */}
              <a href="#" aria-label="LinkedIn" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:border-white/30 hover:text-white">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
