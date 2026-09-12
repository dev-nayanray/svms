"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight, ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarketingButton } from "./ui";
import { EuroscopeLogo } from "./logo";

/**
 * Navigation structure — grouped into top-level links + a dropdown
 * for "Study in Europe" with the most popular European destinations.
 *
 * The active state uses `pathname === href || pathname.startsWith(href + "/")`
 * so sub-routes (e.g. /study-in-europe/germany) activate the parent
 * link — this is the standard SaaS navbar pattern.
 */
const DESTINATIONS = [
  { href: "/study-in-europe/germany", label: "Germany", flag: "🇩🇪" },
  { href: "/study-in-europe/france", label: "France", flag: "🇫🇷" },
  { href: "/study-in-europe/italy", label: "Italy", flag: "🇮🇹" },
  { href: "/study-in-europe/spain", label: "Spain", flag: "🇪🇸" },
  { href: "/study-in-europe/netherlands", label: "Netherlands", flag: "🇳🇱" },
  { href: "/study-in-europe/sweden", label: "Sweden", flag: "🇸🇪" },
  { href: "/study-in-europe/finland", label: "Finland", flag: "🇫🇮" },
  { href: "/study-in-europe/ireland", label: "Ireland", flag: "🇮🇪" },
];

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/study-in-europe", label: "Study in Europe", hasDropdown: true },
  { href: "/universities", label: "Universities" },
  { href: "/courses", label: "Courses" },
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MarketingNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileDestinationsOpen, setMobileDestinationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close desktop dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDestinationsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Close mobile menu on Escape
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setDestinationsOpen(false);
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMobile = () => {
    setMobileOpen(false);
    setMobileDestinationsOpen(false);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-sm"
          : "border-b border-transparent bg-background/0",
      )}
    >
      <nav
        className="euroscope-container flex h-16 items-center justify-between gap-4 md:h-18"
        aria-label="Primary"
      >
        {/* Logo */}
        <Link
          href="/"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Euroscope home"
        >
          <EuroscopeLogo size="default" />
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-0.5 xl:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            if (link.hasDropdown) {
              return (
                <li key={link.href} className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDestinationsOpen((o) => !o)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
                      active || destinationsOpen ? "text-primary" : "text-foreground/80",
                    )}
                    aria-expanded={destinationsOpen}
                    aria-haspopup="true"
                  >
                    {link.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        destinationsOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                  {/* Dropdown */}
                  {destinationsOpen && (
                    <div className="absolute left-0 top-full pt-2">
                      <div className="w-72 rounded-2xl border border-border bg-card p-2 shadow-xl shadow-primary/5">
                        <div className="grid grid-cols-2 gap-1">
                          {DESTINATIONS.map((dest) => (
                            <Link
                              key={dest.href}
                              href={dest.href}
                              onClick={() => setDestinationsOpen(false)}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-primary"
                            >
                              <span className="text-base" aria-hidden>{dest.flag}</span>
                              {dest.label}
                            </Link>
                          ))}
                        </div>
                        <div className="mt-2 border-t border-border pt-2">
                          <Link
                            href="/study-in-europe"
                            onClick={() => setDestinationsOpen(false)}
                            className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            <span>All destinations</span>
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            }
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
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
        <div className="hidden items-center gap-2 xl:flex">
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

        {/* Tablet/desktop menu (lg to xl) — compact CTA only */}
        <div className="hidden items-center gap-2 lg:flex xl:hidden">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            Login
          </Link>
          <MarketingButton href="/contact" size="sm">Get Started</MarketingButton>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="grid h-11 w-11 place-items-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu — full-screen slide-down */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-40 overflow-y-auto bg-background lg:hidden">
          <div className="euroscope-container py-6">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                if (link.hasDropdown) {
                  return (
                    <li key={link.href}>
                      <button
                        type="button"
                        onClick={() => setMobileDestinationsOpen((o) => !o)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-medium",
                          active ? "text-primary" : "text-foreground/80 hover:bg-muted",
                        )}
                        aria-expanded={mobileDestinationsOpen}
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="h-4 w-4" aria-hidden />
                          {link.label}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            mobileDestinationsOpen && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </button>
                      {mobileDestinationsOpen && (
                        <ul className="ml-3 mt-1 space-y-0.5 border-l-2 border-border pl-3">
                          {DESTINATIONS.map((dest) => (
                            <li key={dest.href}>
                              <Link
                                href={dest.href}
                                onClick={closeMobile}
                                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground/70 hover:bg-muted hover:text-primary"
                              >
                                <span aria-hidden>{dest.flag}</span>
                                {dest.label}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              href="/study-in-europe"
                              onClick={closeMobile}
                              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
                            >
                              All destinations
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </li>
                        </ul>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={closeMobile}
                      className={cn(
                        "block rounded-lg px-3 py-3 text-sm font-medium",
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
            <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
              <Link
                href="/login"
                onClick={closeMobile}
                className="rounded-lg border border-border px-3 py-3 text-center text-sm font-medium hover:bg-muted"
              >
                Login
              </Link>
              <MarketingButton href="/contact" size="default" className="w-full" onClick={closeMobile}>
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
