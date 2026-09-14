import { ok, handleApiError } from "@/lib/api";
import { getBrandSettings } from "@/lib/services/site-settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/brand
 *
 * Public endpoint — returns brand settings (logo URLs, brand name,
 * tagline, colors, contact info) for the marketing site, navbar,
 * footer, and favicon. No auth required.
 *
 * Cached for 5 minutes on the client (staleTime) since brand settings
 * rarely change.
 */
export async function GET() {
  try {
    const brand = await getBrandSettings();
    return ok(brand);
  } catch (err) {
    return handleApiError(err);
  }
}
