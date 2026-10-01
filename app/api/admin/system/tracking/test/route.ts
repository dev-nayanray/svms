import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { recordTestEvent } from "@/lib/system/analytics";
import { z } from "zod";

const testSchema = z.object({
  provider: z.enum(["ga4", "gtm", "meta", "all"]),
  eventName: z.string().min(1).max(100).default("test_event"),
});

/**
 * POST /api/admin/system/tracking/test
 *
 * Records a test event in the system log. The actual provider dispatch
 * happens client-side (server can't call window.gtag). Returns
 * instructions for the admin UI to dispatch the event.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("analytics.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid test event request", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const result = await recordTestEvent(parsed.data.provider, parsed.data.eventName, g.user.id);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
