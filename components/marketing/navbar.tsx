"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants/app";
import { MarketingButton } from "./ui";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/study-in-europe", label: "Study in Europe" },
  { href: "/universities", label: "Universities" },
  { href: "/courses", label: "Courses" },
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu when a link is clicked — avoids the
  // setState-in-effect anti-pattern that fires on route change.
  const closeMobile = () => setOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all",
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-lg supports-[backdrop-filter]:bg-background/75"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        className="euroscope-container flex h-16 items-center justify-between gap-4 md:h-18"
        aria-label="Primary"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`${APP_NAME} home`}
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              {/* European star + arc — subtle brand mark */}
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <path d="M4 14c4-6 12-6 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path
                d="M12 4l1.2 3.6h3.8l-3.1 2.3 1.2 3.6-3.1-2.3-3.1 2.3 1.2-3.6-3.1-2.3h3.8z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight">{APP_NAME}</span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
                    active ? "text-primary" : "text-foreground/80",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            Login
          </Link>
          <MarketingButton href="/contact" size="sm">
            Start Your Journey
            <ArrowRight className="h-4 w-4" aria-hidden />
          </MarketingButton>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="grid h-11 w-11 place-items-center rounded-md text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="euroscope-container py-4">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={closeMobile}
                      className={cn(
                        "block rounded-md px-3 py-2.5 text-sm font-medium",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/80 hover:bg-muted",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <Link
                href="/login"
                className="rounded-lg border border-border px-3 py-2.5 text-center text-sm font-medium hover:bg-muted"
              >
                Login
              </Link>
              <MarketingButton href="/contact" size="default" className="w-full">
                Start Your Journey
                <ArrowRight className="h-4 w-4" aria-hidden />
              </MarketingButton>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
