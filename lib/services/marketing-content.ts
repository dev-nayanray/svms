import { prisma } from "@/lib/db";

/**
 * Marketing content service — reads/writes all editable marketing
 * page content from the SystemSetting table.
 *
 * The content is stored as a single JSON blob under the key
 * `marketing.content`. This avoids creating a new Prisma model
 * and lets admins edit all content from one form.
 *
 * If no content is in the DB (first run), sensible defaults are
 * returned so the marketing site always has content.
 */

const SETTING_KEY = "marketing.content";

export type MarketingContent = {
  hero: {
    badge: string;
    headlinePart1: string;
    headlinePart2: string;
    subtitle: string;
    ctaPrimaryText: string;
    ctaPrimaryHref: string;
    ctaSecondaryText: string;
    ctaSecondaryHref: string;
    trustLine: string;
  };
  cta: {
    eyebrow: string;
    headlinePart1: string;
    headlinePart2: string;
    subtitle: string;
    ctaPrimaryText: string;
    ctaPrimaryHref: string;
    ctaSecondaryText: string;
    ctaSecondaryHref: string;
  };
  faq: { q: string; a: string }[];
};

/** Default content — used when nothing is in the DB yet. */
export const DEFAULT_MARKETING_CONTENT: MarketingContent = {
  hero: {
    badge: "European Education Consultancy",
    headlinePart1: "Study in Europe.",
    headlinePart2: "Start Your Future.",
    subtitle:
      "Euroscope is a European education consultancy that guides students through every step — from choosing the right university to preparing your visa. We don't just give you a portal — we walk with you.",
    ctaPrimaryText: "Book a Free Consultation",
    ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Europe",
    ctaSecondaryHref: "/study-in-europe",
    trustLine: "Personalized guidance · End-to-end support · European expertise",
  },
  cta: {
    eyebrow: "Get Started",
    headlinePart1: "Your European Future",
    headlinePart2: "Starts Here.",
    subtitle:
      "Talk to our counselors and get a personalized plan for your European study journey. No pressure, no obligation — just honest guidance.",
    ctaPrimaryText: "Book a Free Consultation",
    ctaPrimaryHref: "/contact",
    ctaSecondaryText: "Explore Destinations",
    ctaSecondaryHref: "/study-in-europe",
  },
  faq: [
    {
      q: "What is Euroscope?",
      a: "Euroscope is a European education and student visa management platform. It helps students manage their entire journey — from choosing a university to preparing their visa application — in one organized place. It also serves education consultancies that manage multiple students.",
    },
    {
      q: "Which European countries can I study in?",
      a: "Euroscope supports applications to universities across major European study destinations including Germany, France, Italy, Spain, the Netherlands, Sweden, Finland, Denmark, Ireland, Poland, Hungary, Portugal, Austria, Belgium and the Czech Republic. Browse the Study in Europe section for details.",
    },
    {
      q: "How does Euroscope help students?",
      a: "Students get a personal dashboard with their application pipeline, document checklist, visa progress, task deadlines, payments and messages with their counselor. Real-time updates arrive via Server-Sent Events — no refreshing required.",
    },
    {
      q: "Can I track my application?",
      a: "Yes. Every application moves through a visible pipeline — Lead → Counselling → Document Collection → University Application → Offer → Visa → Travel. Students see the current stage, history and next steps in real time.",
    },
    {
      q: "Can I manage documents through Euroscope?",
      a: "Yes. Students upload documents (passport, transcripts, English certificate, financial proof, etc.) to private storage. Counselors review and approve/reject with feedback. Version history is preserved when a document is replaced.",
    },
    {
      q: "How does visa preparation work?",
      a: "Euroscope maintains country-specific visa requirements (e.g., German student visa requires passport, admission letter, blocked account proof, health insurance). Students see a checklist, mark requirements complete, and track visa submission → biometrics → interview → decision.",
    },
    {
      q: "Can employees manage multiple students?",
      a: "Yes. Education employees get a dedicated panel with their assigned students, applications, documents, tasks, visa cases and appointments. They can review documents, schedule appointments, send messages and track performance.",
    },
    {
      q: "Is Euroscope suitable for education consultancies?",
      a: "Yes. Euroscope is built for education consultancies of any size. Admins manage branches, employees, students, finance, reports, roles and permissions, and audit logs. The platform scales from a single counselor to a multi-branch operation.",
    },
    {
      q: "How can I get started?",
      a: 'Click "Start Your Journey" or "Book a Free Consultation" to schedule a call. We\'ll walk you through the platform, set up your account, and help you start your European study journey.',
    },
  ],
};

/**
 * Read the marketing content from the DB. Falls back to defaults
 * if nothing is stored yet, or if the DB is unavailable.
 */
export async function getMarketingContent(): Promise<MarketingContent> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    if (!setting?.value) return DEFAULT_MARKETING_CONTENT;

    const stored = setting.value as Partial<MarketingContent>;
    // Deep-merge with defaults so new fields added later don't break.
    return {
      hero: { ...DEFAULT_MARKETING_CONTENT.hero, ...stored.hero },
      cta: { ...DEFAULT_MARKETING_CONTENT.cta, ...stored.cta },
      faq: stored.faq?.length ? stored.faq : DEFAULT_MARKETING_CONTENT.faq,
    };
  } catch {
    // DB unavailable — use defaults so the page still renders.
    return DEFAULT_MARKETING_CONTENT;
  }
}

/**
 * Write marketing content to the DB. Used by the admin panel.
 */
export async function saveMarketingContent(content: MarketingContent): Promise<void> {
  const jsonValue = JSON.parse(JSON.stringify(content));
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: jsonValue },
    create: { key: SETTING_KEY, value: jsonValue },
  });
}
