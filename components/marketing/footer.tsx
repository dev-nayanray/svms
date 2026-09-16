import Link from "next/link";
import { EuroscopeLogo } from "./logo";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/constants/app";
import { ICONS, FaIcon } from "./icons";
import { Container } from "./ui";
import type { FooterColumn, SocialLink, ContactConfig } from "@/lib/marketing/cms";
import { renderCopyright } from "@/lib/marketing/cms";

type Props = {
  /** Dynamic footer config from CMS. Falls back to hardcoded defaults if null. */
  footerConfig?: {
    description: string;
    columns: FooterColumn[];
    copyrightText: string;
    showSocialLinks: boolean;
  };
  /** Dynamic social links from CMS. */
  socialLinks?: SocialLink[];
  /** Dynamic contact config from CMS. */
  contactConfig?: ContactConfig;
};

// Fallback (used only if CMS config is null — e.g. DB unreachable)
const FALLBACK_COLUMNS: FooterColumn[] = [
  {
    id: "fallback-study",
    heading: "Study in Europe",
    enabled: true,
    links: [
      { id: "fb-germany", label: "Germany", href: "/study-in-europe/germany" },
      { id: "fb-france", label: "France", href: "/study-in-europe/france" },
      { id: "fb-italy", label: "Italy", href: "/study-in-europe/italy" },
      { id: "fb-spain", label: "Spain", href: "/study-in-europe/spain" },
    ],
  },
  {
    id: "fallback-platform",
    heading: "Platform",
    enabled: true,
    links: [
      { id: "fb-features", label: "Features", href: "/features" },
      { id: "fb-universities", label: "Universities", href: "/universities" },
      { id: "fb-support", label: "Support", href: "/support" },
      { id: "fb-contact", label: "Contact", href: "/contact" },
    ],
  },
  {
    id: "fallback-company",
    heading: "Company",
    enabled: true,
    links: [
      { id: "fb-about", label: "About", href: "/about" },
      { id: "fb-contact2", label: "Contact", href: "/contact" },
      { id: "fb-privacy", label: "Privacy Policy", href: "/about#privacy" },
    ],
  },
];

const FALLBACK_SOCIAL: SocialLink[] = [
  { id: "fb-soc-fb", platform: "facebook", label: "Facebook", url: "#", enabled: true, openInNewTab: true, order: 1 },
  { id: "fb-soc-ig", platform: "instagram", label: "Instagram", url: "#", enabled: true, openInNewTab: true, order: 2 },
  { id: "fb-soc-li", platform: "linkedin", label: "LinkedIn", url: "#", enabled: true, openInNewTab: true, order: 3 },
];

// Social media icon paths (inline SVG, safe — not admin-provided)
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  facebook: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />,
  instagram: <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />,
  linkedin: <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />,
  youtube: <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />,
  x: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
  whatsapp: <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.821 11.821 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.516 5.26l-.999 3.648 3.973-1.041z" />,
  telegram: <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />,
};

function SocialIcon({ platform, className }: { platform: string; className?: string }) {
  const path = SOCIAL_ICONS[platform.toLowerCase()];
  if (path) {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        {path}
      </svg>
    );
  }
  // Generic icon for unknown platforms
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.65-.532a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.5 11.25" />
    </svg>
  );
}

export function MarketingFooter({ footerConfig, socialLinks, contactConfig }: Props) {
  const columns = (footerConfig?.columns ?? FALLBACK_COLUMNS).filter((c) => c.enabled);
  const description = footerConfig?.description ?? APP_DESCRIPTION;
  const copyrightText = footerConfig?.copyrightText ?? `© {year} ${APP_NAME}. All rights reserved.`;
  const showSocial = footerConfig?.showSocialLinks ?? true;
  const socials = (socialLinks ?? FALLBACK_SOCIAL)
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
  const companyName = contactConfig?.companyName || APP_NAME;

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
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{description}</p>

            {/* Contact info (dynamic) */}
            {contactConfig && (contactConfig.email || contactConfig.phone) && (
              <div className="mt-4 space-y-1 text-xs text-white/50">
                {contactConfig.email && (
                  <p>
                    <a href={`mailto:${contactConfig.email}`} className="hover:text-white">{contactConfig.email}</a>
                  </p>
                )}
                {contactConfig.phone && (
                  <p>
                    <a href={`tel:${contactConfig.phone}`} className="hover:text-white">{contactConfig.phone}</a>
                  </p>
                )}
                {contactConfig.address && <p>{contactConfig.address}</p>}
              </div>
            )}

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

          {/* Link columns — dynamic from CMS */}
          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8" aria-label="Footer">
            {columns.map((column) => (
              <div key={column.id}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">
                  {column.heading}
                </h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.id}>
                      <Link
                        href={link.href}
                        {...(link.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
            {renderCopyright(copyrightText)}
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs text-white/40">
              Built for students on the European journey.
            </p>
            {showSocial && socials.length > 0 && (
              <div className="flex items-center gap-3">
                {socials.map((social) => (
                  <a
                    key={social.id}
                    href={social.url}
                    aria-label={social.label}
                    {...(social.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:border-white/30 hover:text-white"
                  >
                    <SocialIcon platform={social.platform} className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </footer>
  );
}
