import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getAnalyticsStatus, updateAnalyticsConfig } from "@/lib/system/analytics";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

const analyticsUpdateSchema = z.object({
  ga4: z.object({
    enabled: z.boolean().optional(),
    measurementId: z.string().max(50).optional(),
  }).optional(),
  gtm: z.object({
    enabled: z.boolean().optional(),
    containerId: z.string().max(50).optional(),
  }).optional(),
  meta: z.object({
    enabled: z.boolean().optional(),
    pixelId: z.string().max(50).optional(),
  }).optional(),
  vercelAnalytics: z.object({ enabled: z.boolean().optional() }).optional(),
  vercelSpeedInsights: z.object({ enabled: z.boolean().optional() }).optional(),
});

/**
 * GET /api/admin/system/analytics
 * Returns the analytics config + env var status + validation.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("analytics.read");
    if (g.error) return g.error;
    const status = await getAnalyticsStatus();
    return ok(status);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/system/analytics
 * Updates analytics configuration. Validates IDs before persisting.
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("analytics.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = analyticsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid analytics config", 422, {
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      });
    }
    const ctx = auditLog.fromRequest(req);
    await updateAnalyticsConfig(parsed.data, g.user.id, ctx);
    return ok({ saved: true });
  } catch (err) {
    return handleApiError(err);
  }
}
