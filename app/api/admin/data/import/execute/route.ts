import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { validatePayload, executeImport, type ImportPayload, type ImportMode } from "@/lib/services/data-import";
import { z } from "zod";

export const dynamic = "force-dynamic";

const executeSchema = z.object({
  version: z.string().optional(),
  module: z.string(),
  records: z.array(z.record(z.string(), z.unknown())),
  mode: z.enum(["create", "update", "validate"]).default("create"),
});

/**
 * POST /api/admin/data/import/execute
 *
 * Executes an import — creates/updates records in the database.
 * Supports 3 modes:
 *  - create: only create new records (skip duplicates)
 *  - update: only update existing records (skip new)
 *  - validate: validate without writing (dry run)
 *
 * Body: { version, module, records: [...], mode: "create"|"update"|"validate" }
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.generalUpload, "import-execute");
    if (limited) return limited as Response;

    const g = await guard();
    if (g.error) return g.error;

    const body = executeSchema.parse(await req.json().catch(() => ({})));
    const validation = validatePayload(body);
    if (!validation.valid) {
      return ok({ error: validation.error });
    }

    const result = await executeImport(
      validation.data as ImportPayload,
      body.mode as ImportMode,
      g.user.id,
    );
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
