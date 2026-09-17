import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getAllConfig, setConfig } from "@/lib/system/config";
import { checkEnvironment } from "@/lib/system/env";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

const configUpdateSchema = z.object({
  updates: z.record(z.string(), z.unknown()),
});

/**
 * GET /api/admin/system/configuration
 * Returns the full config map + env var health check.
 * Secrets are NEVER returned — only Configured / Not Configured flags.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("system.config.read");
    if (g.error) return g.error;
    const [config, env] = await Promise.all([getAllConfig(), checkEnvironment()]);
    return ok({ config, env });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/admin/system/configuration
 * Bulk-update config keys. Each key must be a known config path.
 * Refuses to persist anything matching /secret|password|token|api[_-]?key/i.
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard("system.config.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = configUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid config update", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const ctx = auditLog.fromRequest(req);
    const written: string[] = [];
    for (const [key, value] of Object.entries(parsed.data.updates)) {
      try {
        await setConfig(key, value, g.user.id);
        written.push(key);
      } catch (err) {
        // Skip a single bad key but continue with the rest.
        await auditLog.record({
          userId: g.user.id,
          action: "system.config.update_failed",
          entity: "SystemSetting",
          entityId: key,
          newValue: { error: err instanceof Error ? err.message : String(err) },
          ...ctx,
        });
      }
    }
    await auditLog.record({
      userId: g.user.id,
      action: "configuration.changed",
      entity: "SystemSetting",
      entityId: "bulk",
      newValue: { written },
      ...ctx,
    });
    return ok({ written, count: written.length });
  } catch (err) {
    return handleApiError(err);
  }
}
