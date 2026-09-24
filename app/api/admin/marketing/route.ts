import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getCmsConfig, saveCmsConfig, resetCmsConfig, DEFAULT_CMS_CONFIG, type CmsConfig } from "@/lib/marketing/cms";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketing
 * Returns the full CMS config (header, nav, footer, social, contact, announcement, SEO).
 * Admin-only.
 */
export async function GET() {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;
    const config = await getCmsConfig();
    return ok({ config, defaults: DEFAULT_CMS_CONFIG });
  } catch (err) {
    return handleApiError(err);
  }
}

const cmsSchema = z.object({
  header: z.object({
    sticky: z.boolean(),
    transparent: z.boolean(),
    ctaText: z.string().max(100),
    ctaHref: z.string().max(500),
    ctaVisibleDesktop: z.boolean(),
    ctaVisibleMobile: z.boolean(),
  }),
  navigation: z.array(z.object({
    id: z.string(),
    label: z.string().max(100),
    href: z.string().max(500),
    enabled: z.boolean(),
    openInNewTab: z.boolean().optional(),
    children: z.array(z.object({
      id: z.string(),
      label: z.string().max(100),
      href: z.string().max(500),
      enabled: z.boolean(),
      openInNewTab: z.boolean().optional(),
    })).optional(),
  })),
  footer: z.object({
    description: z.string().max(1000),
    columns: z.array(z.object({
      id: z.string(),
      heading: z.string().max(100),
      enabled: z.boolean(),
      links: z.array(z.object({
        id: z.string(),
        label: z.string().max(100),
        href: z.string().max(500),
        openInNewTab: z.boolean().optional(),
      })),
    })),
    copyrightText: z.string().max(200),
    showSocialLinks: z.boolean(),
  }),
  social: z.array(z.object({
    id: z.string(),
    platform: z.string().max(50),
    label: z.string().max(100),
    url: z.string().max(500),
    enabled: z.boolean(),
    openInNewTab: z.boolean(),
    order: z.number(),
  })),
  contact: z.object({
    companyName: z.string().max(200),
    email: z.string().max(200),
    supportEmail: z.string().max(200),
    phone: z.string().max(50),
    whatsapp: z.string().max(50),
    address: z.string().max(500),
    officeHours: z.string().max(200),
    supportHours: z.string().max(200),
    googleMapsUrl: z.string().max(500),
  }),
  announcement: z.object({
    enabled: z.boolean(),
    message: z.string().max(500),
    linkText: z.string().max(100),
    linkUrl: z.string().max(500),
    dismissible: z.boolean(),
    startAt: z.string().nullable(),
    endAt: z.string().nullable(),
  }),
  seo: z.object({
    globalTitle: z.string().max(200),
    globalDescription: z.string().max(500),
    defaultOgImage: z.string().max(500),
    defaultTwitterImage: z.string().max(500),
    locale: z.string().max(10),
  }),
  publishedVersion: z.number().optional(),
});

/**
 * PUT /api/admin/marketing
 * Save the full CMS config. Validates with Zod, sanitizes URLs (no javascript:/data:),
 * audits the change, and revalidates all marketing pages.
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = cmsSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid CMS config", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const ctx = auditLog.fromRequest(req);
    const saved = await saveCmsConfig(parsed.data as CmsConfig, g.user.id, ctx);
    return ok({ config: saved });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/marketing
 * Reset CMS config to defaults.
 */
export async function DELETE(req: NextRequest) {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;
    const ctx = auditLog.fromRequest(req);
    const config = await resetCmsConfig(g.user.id);
    await auditLog.record({
      userId: g.user.id,
      action: "marketing.cms_reset.requested",
      entity: "SystemSetting",
      entityId: "marketing.cms",
      ...ctx,
    });
    return ok({ config });
  } catch (err) {
    return handleApiError(err);
  }
}
