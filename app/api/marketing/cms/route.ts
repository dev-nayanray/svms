import { ok, handleApiError } from "@/lib/api";
import { getCmsConfig, isAnnouncementActive } from "@/lib/marketing/cms";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/cms
 *
 * Public endpoint — returns the CMS config for the public marketing site.
 * Used by the navbar + footer + announcement bar to render dynamic content.
 */
export async function GET() {
  try {
    const config = await getCmsConfig();
    return ok({
      header: config.header,
      navigation: config.navigation,
      footer: config.footer,
      social: config.social,
      contact: config.contact,
      announcement: {
        ...config.announcement,
        active: isAnnouncementActive(config.announcement),
      },
      seo: config.seo,
      lastUpdated: config.lastUpdated,
      publishedVersion: config.publishedVersion,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
