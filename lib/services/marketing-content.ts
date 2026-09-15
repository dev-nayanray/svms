import { prisma } from "@/lib/db";
import {
  type MarketingContent,
  DEFAULT_MARKETING_CONTENT,
} from "@/lib/types/marketing-content";

// Re-export types + defaults for server-side consumers
export type { MarketingContent, ContentItem, IconKey } from "@/lib/types/marketing-content";
export { DEFAULT_MARKETING_CONTENT } from "@/lib/types/marketing-content";

const SETTING_KEY = "marketing.content";

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
    return {
      hero: { ...DEFAULT_MARKETING_CONTENT.hero, ...stored.hero },
      services: stored.services?.length ? stored.services : DEFAULT_MARKETING_CONTENT.services,
      whyEuroscope: stored.whyEuroscope?.length ? stored.whyEuroscope : DEFAULT_MARKETING_CONTENT.whyEuroscope,
      howWeHelp: stored.howWeHelp?.length ? stored.howWeHelp : DEFAULT_MARKETING_CONTENT.howWeHelp,
      problems: stored.problems?.length ? stored.problems : DEFAULT_MARKETING_CONTENT.problems,
      trust: stored.trust?.length ? stored.trust : DEFAULT_MARKETING_CONTENT.trust,
      cta: { ...DEFAULT_MARKETING_CONTENT.cta, ...stored.cta },
      faq: stored.faq?.length ? stored.faq : DEFAULT_MARKETING_CONTENT.faq,
    };
  } catch {
    return DEFAULT_MARKETING_CONTENT;
  }
}

export async function saveMarketingContent(content: MarketingContent): Promise<void> {
  const jsonValue = JSON.parse(JSON.stringify(content));
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: jsonValue },
    create: { key: SETTING_KEY, value: jsonValue },
  });
}
