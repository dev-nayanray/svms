import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { validatePayload, previewImport, type ImportPayload } from "@/lib/services/data-import";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/data/import/preview
 *
 * Validates an import payload WITHOUT writing to the database.
 * Returns validation results + first 50 rows for preview.
 *
 * Body: { version, module, records: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.generalUpload, "import-preview");
    if (limited) return limited as Response;

    const g = await guard();
    if (g.error) return g.error;

    const body = await req.json().catch(() => null);
    const validation = validatePayload(body);
    if (!validation.valid) {
      return ok({ error: validation.error });
    }

    const result = await previewImport(validation.data as ImportPayload);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
