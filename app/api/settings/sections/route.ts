import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { SETTING_SECTIONS } from "@/lib/constants/settings";

/**
 * Returns the setting section metadata for the admin UI — section keys,
 * labels, icons, and descriptions. This is static data (doesn't require
 * a DB query) so it's cached on the client.
 */
export async function GET() {
  try {
    const g = await guard("settings.manage");
    if (g.error) return g.error;

    return ok({
      data: SETTING_SECTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        icon: s.icon,
        description: s.description,
        settingCount: s.settings.length,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
