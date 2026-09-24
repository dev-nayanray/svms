"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ICONS, FaIcon } from "./icons";
import { cn } from "@/lib/utils";
import { MarketingButton } from "./ui";
import { EuroscopeLogo } from "./logo";
import { ROLE_HOME } from "@/lib/permissions";
import type { NavItem, HeaderConfig } from "@/lib/marketing/cms";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

type Props = {
  /** Dynamic navigation from CMS. Falls back to hardcoded defaults if null. */
  navigation?: NavItem[];
  /** Dynamic header config from CMS. Falls back to defaults if null. */
  headerConfig?: HeaderConfig;
};

export function MarketingNavbar({ navigation, headerConfig }: Props) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileDestinationsOpen, setMobileDestinationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement | null>(null);

  const isLoggedIn = status === "authenticated" && session?.user?.role;
  const dashboardHref = isLoggedIn
    ? ROLE_HOME[session.user.role as keyof typeof ROLE_HOME] ?? "/login"
    : "/login";

  // Use CMS-provided navigation, fallback to null (no nav shown if CMS fails)
  // But we have hardcoded defaults baked into the CMS service, so this should
  // always have items unless the admin explicitly disabled them all.
  const navItems = (navigation ?? []).filter((item) => item.enabled);
  const ctaText = headerConfig?.ctaText || "Book a Consultation";
  const ctaHref = headerConfig?.ctaHref || "/contact";
  const ctaDesktop = headerConfig?.ctaVisibleDesktop ?? true;
  const ctaMobile = headerConfig?.ctaVisibleMobile ?? true;
  const sticky = headerConfig?.sticky ?? true;

  useEffect(() => {
    if (!sticky) return;
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sticky]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDestinationsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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

  // Close mobile menu on route change — React's official "adjust state during
  // render" pattern (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // This avoids the setState-in-effect lint warning.
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMobileOpen(false);
  }

  const closeMobile = () => {
    setMobileOpen(false);
    setMobileDestinationsOpen(false);
  };

  return (
    <header
      className={cn(
        sticky ? "sticky top-0 z-50 w-full transition-all duration-300" : "relative z-50",
        scrolled
          ? "border-b border-border bg-background/95 backdrop-blur-xl shadow-sm"
          : "border-b border-border bg-background",
      )}
    >
      <nav
        className="euroscope-container flex h-16 items-center justify-between gap-4"
        aria-label="Primary"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Euroscope home"
        >
          <EuroscopeLogo size="default" variant="mark" showWordmark={true} />
        </Link>

        {/* Desktop links — dynamic from CMS */}
        <ul className="hidden items-center gap-1 lg:flex">
          {navItems.map((link) => {
            const active = isActive(pathname, link.href);
            if (link.children && link.children.length > 0) {
              return (
                <li key={link.id} className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDestinationsOpen((o) => !o)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
                      active || destinationsOpen ? "text-primary" : "text-slate-700",
                    )}
                    aria-expanded={destinationsOpen}
                    aria-haspopup="true"
                  >
                    {link.label}
                    <FaIcon
                      icon={ICONS.chevronDown}
                      className={cn("h-3 w-3 transition-transform duration-200", destinationsOpen && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                  {destinationsOpen && (
                    <div className="absolute left-0 top-full pt-2">
                      <div className="w-72 rounded-2xl border border-border bg-card p-2 shadow-xl shadow-black/5">
                        <div className="grid grid-cols-2 gap-1">
                          {link.children.filter((c) => c.enabled).map((child) => (
                            <Link
                              key={child.id}
                              href={child.href}
                              onClick={() => setDestinationsOpen(false)}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-muted hover:text-primary"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                        <div className="mt-2 border-t border-border pt-2">
                          <Link
                            href={link.href}
                            onClick={() => setDestinationsOpen(false)}
                            className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            <span>All {link.label.toLowerCase()}</span>
                            <FaIcon icon={ICONS.arrowRight} className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            }
            return (
              <li key={link.id}>
                <Link
                  href={link.href}
                  {...(link.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
                    active ? "text-primary" : "text-slate-700",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Desktop CTAs — dynamic from CMS */}
        <div className="hidden items-center gap-3 lg:flex">
          {isLoggedIn ? (
            <>
              <Link
                href={dashboardHref}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-primary"
              >
                Dashboard
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-red-600"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-primary"
            >
              Login
            </Link>
          )}
          {ctaDesktop && (
            <MarketingButton href={ctaHref} size="sm">
              {ctaText}
              <FaIcon icon={ICONS.arrowRight} className="h-3.5 w-3.5" aria-hidden />
            </MarketingButton>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          <FaIcon icon={mobileOpen ? ICONS.xmark : ICONS.bars} className="h-5 w-5" />
        </button>
      </nav>

      {/* Mobile menu — dynamic from CMS */}
      {mobileOpen && (
        <div
          className="fixed inset-0 top-16 z-40 overflow-y-auto bg-background lg:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="euroscope-container min-h-full py-6">
            <ul className="flex flex-col gap-1">
              {navItems.map((link) => {
                const active = isActive(pathname, link.href);
                if (link.children && link.children.length > 0) {
                  return (
                    <li key={link.id}>
                      <button
                        type="button"
                        onClick={() => setMobileDestinationsOpen((o) => !o)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-4 py-3.5 text-base font-medium",
                          active ? "text-primary" : "text-slate-800",
                        )}
                        aria-expanded={mobileDestinationsOpen}
                      >
                        <span>{link.label}</span>
                        <FaIcon
                          icon={ICONS.chevronDown}
                          className={cn("h-4 w-4 transition-transform", mobileDestinationsOpen && "rotate-180")}
                          aria-hidden
                        />
                      </button>
                      {mobileDestinationsOpen && (
                        <ul className="ml-3 mt-1 space-y-0.5 border-l-2 border-border pl-3">
                          {link.children.filter((c) => c.enabled).map((child) => (
                            <li key={child.id}>
                              <Link
                                href={child.href}
                                onClick={closeMobile}
                                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-slate-600 hover:bg-muted hover:text-primary"
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              href={link.href}
                              onClick={closeMobile}
                              className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10"
                            >
                              All {link.label.toLowerCase()}
                              <FaIcon icon={ICONS.arrowRight} className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </li>
                        </ul>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      {...(link.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      onClick={closeMobile}
                      className={cn(
                        "block rounded-lg px-4 py-3.5 text-base font-medium",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-slate-800 hover:bg-muted",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
              {isLoggedIn ? (
                <>
                  <Link
                    href={dashboardHref}
                    onClick={closeMobile}
                    className="rounded-lg border border-border px-4 py-3 text-center text-sm font-medium hover:bg-muted"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-lg border border-border px-4 py-3 text-center text-sm font-medium text-red-600 hover:bg-red-500/10"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMobile}
                  className="rounded-lg border border-border px-4 py-3 text-center text-sm font-medium hover:bg-muted"
                >
                  Login
                </Link>
              )}
              {ctaMobile && (
                <MarketingButton href={ctaHref} size="default" className="w-full" onClick={closeMobile}>
                  {ctaText}
                  <FaIcon icon={ICONS.arrowRight} className="h-4 w-4" aria-hidden />
                </MarketingButton>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
