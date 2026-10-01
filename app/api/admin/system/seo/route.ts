import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { auditSeo, updateSeoConfig } from "@/lib/system/seo";
import { getSeoConfig } from "@/lib/system/config";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

const seoUpdateSchema = z.object({
  "seo.siteName": z.string().max(100).optional(),
  "seo.titleTemplate": z.string().max(200).optional(),
  "seo.metaDescription": z.string().max(500).optional(),
  "seo.locale": z.string().max(10).optional(),
  "seo.language": z.string().max(10).optional(),
  "seo.defaultOgImage": z.string().max(500).optional(),
  "seo.defaultTwitterImage": z.string().max(500).optional(),
  "seo.canonicalBase": z.string().url().max(500).or(z.literal("")).optional(),
  "seo.indexPrivateRoutes": z.boolean().optional(),
});

/**
 * GET /api/admin/system/seo
 * Returns the SEO config + technical audit findings.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("seo.read");
    if (g.error) return g.error;
    const [config, audit] = await Promise.all([getSeoConfig(), auditSeo()]);
    return ok({ config, audit });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/system/seo
 * Updates SEO configuration. Only keys prefixed with "seo." are accepted.
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("seo.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = seoUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid SEO config", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const ctx = auditLog.fromRequest(req);
    await updateSeoConfig(parsed.data, g.user.id, ctx);
    return ok({ saved: true });
  } catch (err) {
    return handleApiError(err);
  }
}
