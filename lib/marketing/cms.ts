import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { revalidateMarketingPages } from "@/lib/system/revalidate";
import type { Prisma } from "@prisma/client";

/**
 * Marketing CMS — unified configuration store
 * ============================================
 *
 * A single JSON blob in SystemSetting (key: "marketing.cms") that holds
 * ALL structural marketing configuration:
 *
 *  - header: CTA text/URL, sticky/transparent flags, height
 *  - navigation: header nav items (with optional submenu)
 *  - footer: columns of links + description + copyright
 *  - social: social media profiles (platform, URL, enabled, order)
 *  - contact: company name, email, phone, WhatsApp, address, hours
 *  - announcement: dismissible banner with scheduling
 *  - seo: global SEO overrides (title, description, OG image)
 *
 * The homepage hero/services/faq content is stored SEPARATELY in
 * SystemSetting key "marketing.content" (managed by the existing
 * MarketingContentEditor) — those are content blocks, not structural
 * config. This CMS manages the chrome (header/footer/nav/social).
 *
 * DEFAULTS match the current hardcoded values in navbar.tsx + footer.tsx
 * so the site looks identical until an admin changes something.
 */

const CMS_KEY = "marketing.cms";

// ─── Types ────────────────────────────────────────────────────────

export type NavItem = {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  openInNewTab?: boolean;
  children?: NavItem[];
};

export type FooterLink = {
  id: string;
  label: string;
  href: string;
  openInNewTab?: boolean;
};

export type FooterColumn = {
  id: string;
  heading: string;
  links: FooterLink[];
  enabled: boolean;
};

export type SocialLink = {
  id: string;
  platform: string;
  label: string;
  url: string;
  enabled: boolean;
  openInNewTab: boolean;
  order: number;
};

export type AnnouncementConfig = {
  enabled: boolean;
  message: string;
  linkText: string;
  linkUrl: string;
  dismissible: boolean;
  startAt: string | null;
  endAt: string | null;
};

export type HeaderConfig = {
  sticky: boolean;
  transparent: boolean;
  ctaText: string;
  ctaHref: string;
  ctaVisibleDesktop: boolean;
  ctaVisibleMobile: boolean;
};

export type ContactConfig = {
  companyName: string;
  email: string;
  supportEmail: string;
  phone: string;
  whatsapp: string;
  address: string;
  officeHours: string;
  supportHours: string;
  googleMapsUrl: string;
};

export type SeoConfig = {
  globalTitle: string;
  globalDescription: string;
  defaultOgImage: string;
  defaultTwitterImage: string;
  locale: string;
};

export type CmsConfig = {
  header: HeaderConfig;
  navigation: NavItem[];
  footer: {
    description: string;
    columns: FooterColumn[];
    copyrightText: string;
    showSocialLinks: boolean;
  };
  social: SocialLink[];
  contact: ContactConfig;
  announcement: AnnouncementConfig;
  seo: SeoConfig;
  lastUpdated: string | null;
  lastUpdatedBy: string | null;
  publishedVersion: number;
};

// ─── Defaults (match current hardcoded navbar + footer) ────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_NAVIGATION: NavItem[] = [
  { id: "nav-home", label: "Home", href: "/", enabled: true },
  {
    id: "nav-destinations",
    label: "Destinations",
    href: "/study-in-europe",
    enabled: true,
    children: [
      { id: "nav-germany", label: "Germany", href: "/study-in-europe/germany", enabled: true },
      { id: "nav-france", label: "France", href: "/study-in-europe/france", enabled: true },
      { id: "nav-italy", label: "Italy", href: "/study-in-europe/italy", enabled: true },
      { id: "nav-spain", label: "Spain", href: "/study-in-europe/spain", enabled: true },
      { id: "nav-netherlands", label: "Netherlands", href: "/study-in-europe/netherlands", enabled: true },
      { id: "nav-sweden", label: "Sweden", href: "/study-in-europe/sweden", enabled: true },
      { id: "nav-finland", label: "Finland", href: "/study-in-europe/finland", enabled: true },
      { id: "nav-ireland", label: "Ireland", href: "/study-in-europe/ireland", enabled: true },
    ],
  },
  { id: "nav-universities", label: "Universities", href: "/universities", enabled: true },
  { id: "nav-services", label: "Services", href: "/features", enabled: true },
  { id: "nav-about", label: "About", href: "/about", enabled: true },
  { id: "nav-contact", label: "Contact", href: "/contact", enabled: true },
];

const DEFAULT_FOOTER_COLUMNS: FooterColumn[] = [
  {
    id: "col-study",
    heading: "Study in Europe",
    enabled: true,
    links: [
      { id: "fl-germany", label: "Germany", href: "/study-in-europe/germany" },
      { id: "fl-france", label: "France", href: "/study-in-europe/france" },
      { id: "fl-italy", label: "Italy", href: "/study-in-europe/italy" },
      { id: "fl-spain", label: "Spain", href: "/study-in-europe/spain" },
      { id: "fl-netherlands", label: "Netherlands", href: "/study-in-europe/netherlands" },
      { id: "fl-ireland", label: "Ireland", href: "/study-in-europe/ireland" },
      { id: "fl-sweden", label: "Sweden", href: "/study-in-europe/sweden" },
      { id: "fl-finland", label: "Finland", href: "/study-in-europe/finland" },
    ],
  },
  {
    id: "col-platform",
    heading: "Platform",
    enabled: true,
    links: [
      { id: "fl-features", label: "Features", href: "/features" },
      { id: "fl-how", label: "How It Works", href: "/how-it-works" },
      { id: "fl-universities", label: "Universities", href: "/universities" },
      { id: "fl-courses", label: "Courses", href: "/courses" },
      { id: "fl-support", label: "Support", href: "/support" },
    ],
  },
  {
    id: "col-resources",
    heading: "Resources",
    enabled: true,
    links: [
      { id: "fl-resources", label: "Resources", href: "/resources" },
      { id: "fl-faq", label: "FAQs", href: "/resources#faq" },
      { id: "fl-contact", label: "Contact", href: "/contact" },
      { id: "fl-about", label: "About Us", href: "/about" },
    ],
  },
  {
    id: "col-company",
    heading: "Company",
    enabled: true,
    links: [
      { id: "fl-about-co", label: "About", href: "/about" },
      { id: "fl-contact-co", label: "Contact", href: "/contact" },
      { id: "fl-privacy", label: "Privacy Policy", href: "/about#privacy" },
      { id: "fl-terms", label: "Terms", href: "/about#terms" },
    ],
  },
];

const DEFAULT_SOCIAL: SocialLink[] = [
  { id: "soc-fb", platform: "facebook", label: "Facebook", url: "#", enabled: true, openInNewTab: true, order: 1 },
  { id: "soc-ig", platform: "instagram", label: "Instagram", url: "#", enabled: true, openInNewTab: true, order: 2 },
  { id: "soc-li", platform: "linkedin", label: "LinkedIn", url: "#", enabled: true, openInNewTab: true, order: 3 },
];

export const DEFAULT_CMS_CONFIG: CmsConfig = {
  header: {
    sticky: true,
    transparent: false,
    ctaText: "Book a Consultation",
    ctaHref: "/contact",
    ctaVisibleDesktop: true,
    ctaVisibleMobile: true,
  },
  navigation: DEFAULT_NAVIGATION,
  footer: {
    description:
      "Euroscope helps students manage their entire European study journey — from choosing the right university to preparing your application and visa — all in one place.",
    columns: DEFAULT_FOOTER_COLUMNS,
    copyrightText: "© {year} Euroscope. All rights reserved.",
    showSocialLinks: true,
  },
  social: DEFAULT_SOCIAL,
  contact: {
    companyName: "Euroscope",
    email: "hello@euroscope.app",
    supportEmail: "support@euroscope.app",
    phone: "+44 20 1234 5678",
    whatsapp: "",
    address: "London, United Kingdom",
    officeHours: "Mon–Fri, 9:00 AM – 6:00 PM GMT",
    supportHours: "Mon–Fri, 9:00 AM – 6:00 PM GMT",
    googleMapsUrl: "",
  },
  announcement: {
    enabled: false,
    message: "Applications for the September intake are now open.",
    linkText: "Apply now",
    linkUrl: "/contact",
    dismissible: true,
    startAt: null,
    endAt: null,
  },
  seo: {
    globalTitle: "Euroscope — Study in Europe. Start Your Future.",
    globalDescription:
      "Euroscope helps students manage their entire European study journey — from choosing the right university to preparing your application and visa — all in one place.",
    defaultOgImage: "/euroscope-logo-full.png",
    defaultTwitterImage: "/euroscope-logo-full.png",
    locale: "en_US",
  },
  lastUpdated: null,
  lastUpdatedBy: null,
  publishedVersion: 1,
};

// ─── Service ───────────────────────────────────────────────────────

export async function getCmsConfig(): Promise<CmsConfig> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: CMS_KEY } });
    if (!row?.value) return DEFAULT_CMS_CONFIG;
    const stored = row.value as Partial<CmsConfig>;
    return mergeConfig(DEFAULT_CMS_CONFIG, stored);
  } catch {
    return DEFAULT_CMS_CONFIG;
  }
}

function mergeConfig(defaults: CmsConfig, stored: Partial<CmsConfig>): CmsConfig {
  return {
    header: { ...defaults.header, ...stored.header },
    navigation: Array.isArray(stored.navigation) ? stored.navigation : defaults.navigation,
    footer: {
      ...defaults.footer,
      ...stored.footer,
      columns: Array.isArray(stored.footer?.columns)
        ? stored.footer!.columns
        : defaults.footer.columns,
    },
    social: Array.isArray(stored.social) ? stored.social : defaults.social,
    contact: { ...defaults.contact, ...stored.contact },
    announcement: { ...defaults.announcement, ...stored.announcement },
    seo: { ...defaults.seo, ...stored.seo },
    lastUpdated: stored.lastUpdated ?? null,
    lastUpdatedBy: stored.lastUpdatedBy ?? null,
    publishedVersion: stored.publishedVersion ?? 1,
  };
}

export async function saveCmsConfig(
  config: CmsConfig,
  actorId: string,
  ctx?: { ipAddress?: string; userAgent?: string },
): Promise<CmsConfig> {
  const sanitized = sanitizeConfig(config);
  const withMeta: CmsConfig = {
    ...sanitized,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: actorId,
    publishedVersion: (sanitized.publishedVersion ?? 1) + 1,
  };

  await prisma.systemSetting.upsert({
    where: { key: CMS_KEY },
    create: { key: CMS_KEY, value: withMeta as Prisma.InputJsonValue },
    update: { value: withMeta as Prisma.InputJsonValue },
  });

  await auditLog.record({
    userId: actorId,
    action: "marketing.cms_updated",
    entity: "SystemSetting",
    entityId: CMS_KEY,
    newValue: { publishedVersion: withMeta.publishedVersion },
    ipAddress: ctx?.ipAddress,
    userAgent: ctx?.userAgent,
  });

  revalidateMarketingPages();
  return withMeta;
}

function sanitizeConfig(config: CmsConfig): CmsConfig {
  const isSafeUrl = (url: string): boolean => {
    if (!url) return true;
    if (url.startsWith("/")) return true;
    if (url.startsWith("#")) return true;
    if (url.startsWith("mailto:")) return true;
    if (url.startsWith("tel:")) return true;
    if (/^https?:\/\//i.test(url)) return true;
    return false;
  };

  const sanitizeNavItem = (item: NavItem): NavItem => ({
    ...item,
    href: isSafeUrl(item.href) ? item.href : "#",
    children: item.children?.map(sanitizeNavItem),
  });

  return {
    ...config,
    navigation: config.navigation.map(sanitizeNavItem),
    footer: {
      ...config.footer,
      columns: config.footer.columns.map((col) => ({
        ...col,
        links: col.links.map((link) => ({
          ...link,
          href: isSafeUrl(link.href) ? link.href : "#",
        })),
      })),
    },
    social: config.social.map((s) => ({
      ...s,
      url: isSafeUrl(s.url) ? s.url : "#",
    })),
    contact: {
      ...config.contact,
      googleMapsUrl: isSafeUrl(config.contact.googleMapsUrl)
        ? config.contact.googleMapsUrl
        : "",
    },
    announcement: {
      ...config.announcement,
      linkUrl: isSafeUrl(config.announcement.linkUrl)
        ? config.announcement.linkUrl
        : "/contact",
    },
    header: {
      ...config.header,
      ctaHref: isSafeUrl(config.header.ctaHref) ? config.header.ctaHref : "/contact",
    },
  };
}

export function isAnnouncementActive(announcement: AnnouncementConfig): boolean {
  if (!announcement.enabled) return false;
  const now = new Date();
  if (announcement.startAt && new Date(announcement.startAt) > now) return false;
  if (announcement.endAt && new Date(announcement.endAt) < now) return false;
  return true;
}

export function renderCopyright(text: string): string {
  return text.replace(/\{year\}/g, String(new Date().getFullYear()));
}

export function newId(): string {
  return genId();
}

export async function resetCmsConfig(actorId: string): Promise<CmsConfig> {
  await prisma.systemSetting.deleteMany({ where: { key: CMS_KEY } });
  await auditLog.record({
    userId: actorId,
    action: "marketing.cms_reset",
    entity: "SystemSetting",
    entityId: CMS_KEY,
    oldValue: { reset: true },
  });
  revalidateMarketingPages();
  return DEFAULT_CMS_CONFIG;
}
