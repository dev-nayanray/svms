import { prisma } from "@/lib/db";

/**
 * Marketing CMS Service
 *
 * Stores marketing site configuration (navigation, footer, social links,
 * announcement bar, SEO, contact info) in the SystemSetting table as JSON.
 *
 * Each config category has its own key:
 *  - marketing.navigation
 *  - marketing.footer
 *  - marketing.social
 *  - marketing.announcement
 *  - marketing.seo
 *  - marketing.contact
 *
 * Defaults are hardcoded so the site works out of the box.
 * Admins override only what they want to change.
 */

// ── Types ──────────────────────────────────────────────────────────

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon?: string;
  hasDropdown?: boolean;
  children?: NavItem[];
  openInNewTab?: boolean;
  enabled: boolean;
  order: number;
};

export type FooterColumn = {
  id: string;
  heading: string;
  links: { id: string; label: string; href: string }[];
  order: number;
};

export type SocialLink = {
  id: string;
  platform: string;
  label: string;
  url: string;
  enabled: boolean;
  order: number;
};

export type AnnouncementBar = {
  enabled: boolean;
  message: string;
  link?: string;
  linkLabel?: string;
  bgColor: string;
  textColor: string;
  dismissible: boolean;
  startDate?: string;
  endDate?: string;
};

export type SEOConfig = {
  defaultTitle: string;
  defaultDescription: string;
  ogImage?: string;
  twitterCard: "summary" | "summary_large_image";
  robots: "index, follow" | "noindex, nofollow";
  canonical?: string;
};

export type ContactConfig = {
  email: string;
  phone: string;
  whatsapp?: string;
  address: string;
  mapsUrl?: string;
  hours: string;
};

export type MarketingCMSConfig = {
  navigation: NavItem[];
  footer: {
    columns: FooterColumn[];
    copyright: string;
    description: string;
  };
  social: SocialLink[];
  announcement: AnnouncementBar;
  seo: SEOConfig;
  contact: ContactConfig;
};

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_NAVIGATION: NavItem[] = [
  { id: "nav-home", label: "Home", href: "/", enabled: true, order: 0 },
  { id: "nav-dest", label: "Destinations", href: "/study-in-europe", hasDropdown: true, enabled: true, order: 1, children: [
    { id: "nav-de", label: "Germany", href: "/study-in-europe/germany", enabled: true, order: 0 },
    { id: "nav-fr", label: "France", href: "/study-in-europe/france", enabled: true, order: 1 },
    { id: "nav-it", label: "Italy", href: "/study-in-europe/italy", enabled: true, order: 2 },
    { id: "nav-es", label: "Spain", href: "/study-in-europe/spain", enabled: true, order: 3 },
    { id: "nav-nl", label: "Netherlands", href: "/study-in-europe/netherlands", enabled: true, order: 4 },
    { id: "nav-se", label: "Sweden", href: "/study-in-europe/sweden", enabled: true, order: 5 },
    { id: "nav-fi", label: "Finland", href: "/study-in-europe/finland", enabled: true, order: 6 },
    { id: "nav-ie", label: "Ireland", href: "/study-in-europe/ireland", enabled: true, order: 7 },
  ]},
  { id: "nav-uni", label: "Universities", href: "/universities", enabled: true, order: 2 },
  { id: "nav-svc", label: "Services", href: "/features", enabled: true, order: 3 },
  { id: "nav-about", label: "About", href: "/about", enabled: true, order: 4 },
  { id: "nav-contact", label: "Contact", href: "/contact", enabled: true, order: 5 },
];

const DEFAULT_FOOTER = {
  columns: [
    { id: "fc-study", heading: "Study in Europe", order: 0, links: [
      { id: "fl-de", label: "Germany", href: "/study-in-europe/germany" },
      { id: "fl-fr", label: "France", href: "/study-in-europe/france" },
      { id: "fl-it", label: "Italy", href: "/study-in-europe/italy" },
      { id: "fl-es", label: "Spain", href: "/study-in-europe/spain" },
      { id: "fl-nl", label: "Netherlands", href: "/study-in-europe/netherlands" },
      { id: "fl-ie", label: "Ireland", href: "/study-in-europe/ireland" },
    ]},
    { id: "fc-platform", heading: "Platform", order: 1, links: [
      { id: "fl-feat", label: "Features", href: "/features" },
      { id: "fl-how", label: "How It Works", href: "/how-it-works" },
      { id: "fl-student", label: "Student Portal", href: "/student" },
      { id: "fl-admin", label: "Admin Platform", href: "/admin" },
    ]},
    { id: "fc-resources", heading: "Resources", order: 2, links: [
      { id: "fl-uni", label: "Universities", href: "/universities" },
      { id: "fl-courses", label: "Courses", href: "/courses" },
      { id: "fl-faq", label: "FAQs", href: "/resources#faq" },
      { id: "fl-contact", label: "Contact", href: "/contact" },
    ]},
    { id: "fc-company", heading: "Company", order: 3, links: [
      { id: "fl-about", label: "About", href: "/about" },
      { id: "fl-contact2", label: "Contact", href: "/contact" },
    ]},
  ],
  copyright: "© {year} Euroscope. All rights reserved.",
  description: "Euroscope helps students manage their entire European study journey — from choosing the right university to preparing your application and visa — all in one place.",
};

const DEFAULT_SOCIAL: SocialLink[] = [
  { id: "soc-fb", platform: "Facebook", label: "Facebook", url: "https://facebook.com/euroscope", enabled: true, order: 0 },
  { id: "soc-ig", platform: "Instagram", label: "Instagram", url: "https://instagram.com/euroscope", enabled: true, order: 1 },
  { id: "soc-li", platform: "LinkedIn", label: "LinkedIn", url: "https://linkedin.com/company/euroscope", enabled: true, order: 2 },
  { id: "soc-yt", platform: "YouTube", label: "YouTube", url: "https://youtube.com/@euroscope", enabled: false, order: 3 },
];

const DEFAULT_ANNOUNCEMENT: AnnouncementBar = {
  enabled: false,
  message: "",
  link: "",
  linkLabel: "",
  bgColor: "#1e293b",
  textColor: "#ffffff",
  dismissible: true,
};

const DEFAULT_SEO: SEOConfig = {
  defaultTitle: "Euroscope — Study in Europe. Start Your Future.",
  defaultDescription: "Euroscope helps students manage their entire European study journey — from choosing the right university to preparing your application and visa — all in one place.",
  twitterCard: "summary_large_image",
  robots: "index, follow",
};

const DEFAULT_CONTACT: ContactConfig = {
  email: "hello@euroscope.app",
  phone: "+44 20 1234 5678",
  whatsapp: "",
  address: "London, United Kingdom",
  mapsUrl: "",
  hours: "Sunday - Thursday: 9:00 AM - 6:00 PM (BST)",
};

const DEFAULT_CONFIG: MarketingCMSConfig = {
  navigation: DEFAULT_NAVIGATION,
  footer: DEFAULT_FOOTER,
  social: DEFAULT_SOCIAL,
  announcement: DEFAULT_ANNOUNCEMENT,
  seo: DEFAULT_SEO,
  contact: DEFAULT_CONTACT,
};

// ── Service ────────────────────────────────────────────────────────

const SETTING_KEY = "marketing.cms";

export async function getMarketingCMS(): Promise<MarketingCMSConfig> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    if (!setting?.value) return DEFAULT_CONFIG;

    const stored = setting.value as Partial<MarketingCMSConfig>;
    return {
      navigation: stored.navigation?.length ? stored.navigation : DEFAULT_NAVIGATION,
      footer: {
        columns: stored.footer?.columns?.length ? stored.footer.columns : DEFAULT_FOOTER.columns,
        copyright: stored.footer?.copyright ?? DEFAULT_FOOTER.copyright,
        description: stored.footer?.description ?? DEFAULT_FOOTER.description,
      },
      social: stored.social?.length ? stored.social : DEFAULT_SOCIAL,
      announcement: { ...DEFAULT_ANNOUNCEMENT, ...stored.announcement },
      seo: { ...DEFAULT_SEO, ...stored.seo },
      contact: { ...DEFAULT_CONTACT, ...stored.contact },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveMarketingCMS(config: MarketingCMSConfig): Promise<void> {
  const jsonValue = JSON.parse(JSON.stringify(config));
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: jsonValue },
    create: { key: SETTING_KEY, value: jsonValue },
  });
}

export { DEFAULT_CONFIG };
