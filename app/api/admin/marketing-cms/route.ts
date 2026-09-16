import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { auditLog } from "@/lib/services/audit";
import { getMarketingCMS, saveMarketingCMS, type MarketingCMSConfig } from "@/lib/services/marketing-cms";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketing-cms
 * Returns the complete marketing CMS configuration.
 */
export async function GET() {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const config = await getMarketingCMS();
    return ok(config);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/marketing-cms
 * Saves the complete marketing CMS configuration.
 * Body: MarketingCMSConfig
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const body = (await req.json().catch(() => ({}))) as MarketingCMSConfig;
    await saveMarketingCMS(body);

    await auditLog.record({
      userId: g.user.id,
      action: "marketing.cms_updated",
      entity: "SystemSetting",
      entityId: "marketing.cms",
    });

    return ok({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
