import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getAllSettings, upsertSetting, deleteSetting } from "@/lib/services/site-settings";
import { z } from "zod";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  key: z.string().min(1),
  value: z.string().nullable(),
});

/**
 * GET /api/admin/site-settings
 *
 * Returns all site settings (logo URLs, brand name, colors, contact info).
 * Admin-only — these include internal labels + descriptions.
 */
export async function GET() {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const settings = await getAllSettings();
    return ok({ settings });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/site-settings
 *
 * Upsert a single setting (key + value). Used by the logo management
 * form when the admin saves changes.
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = upsertSchema.parse(await req.json().catch(() => ({})));
    await upsertSetting(body.key, body.value, g.user.id);
    return ok({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/site-settings?key=<key>
 *
 * Delete a setting (reverts to the hardcoded default).
 */
export async function DELETE(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const key = req.nextUrl.searchParams.get("key");
    if (!key) return fail("VALIDATION_ERROR", "Key is required", 422);
    await deleteSetting(key, g.user.id);
    return ok({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
