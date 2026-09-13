import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getMarketingContent, saveMarketingContent, type MarketingContent } from "@/lib/services/marketing-content";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketing-content
 *
 * Returns the current marketing content (hero, CTA, FAQ).
 * Admin-only — requires the `settings.read` permission.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;

    const content = await getMarketingContent();
    return ok(content);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/marketing-content
 *
 * Updates the marketing content. Admin-only — requires `settings.manage`.
 * The body is the full MarketingContent object (hero, cta, faq).
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;

    const body = (await req.json()) as MarketingContent;
    await saveMarketingContent(body);
    return ok({ saved: true });
  } catch (err) {
    return handleApiError(err);
  }
}
