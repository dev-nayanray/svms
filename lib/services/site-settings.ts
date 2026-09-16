import { prisma } from "@/lib/db";
import { auditLog } from "./audit";

/**
 * Site Settings service — manages dynamic branding (logo, brand name,
 * colors, contact info) that admins can change without redeploying.
 *
 * Settings are stored as key-value pairs in the SiteSetting table.
 * Each setting has a type (text, image, url, color) so the admin UI
 * knows how to render the editor.
 *
 * Defaults are hardcoded in DEFAULTS below — if no DB row exists for
 * a key, the default is returned. This means the site works out of
 * the box and admins only override what they want to change.
 */

export type SettingType = "text" | "image" | "url" | "color";

export type SettingDef = {
  key: string;
  label: string;
  type: SettingType;
  default: string;
  description?: string;
};

export type SettingValue = {
  key: string;
  label: string;
  type: SettingType;
  value: string | null;
  default: string;
  description?: string;
};

/**
 * The canonical list of settings the admin can manage.
 * To add a new setting, add it here + the getSetting() helper below.
 */
export const SETTING_DEFS: SettingDef[] = [
  {
    key: "brand_logo",
    label: "Logo (default)",
    type: "image",
    default: "/euroscope-mark.png",
    description: "Main logo used on light backgrounds (navbar, admin shell). Recommended size: 512×512 PNG with transparent background.",
  },
  {
    key: "brand_logo_light",
    label: "Logo (light variant)",
    type: "image",
    default: "/euroscope-mark.png",
    description: "Logo used on dark backgrounds (footer, dark hero sections). Use a white or light version if available.",
  },
  {
    key: "brand_logo_full",
    label: "Logo with wordmark",
    type: "image",
    default: "/euroscope-logo-full.png",
    description: "Horizontal logo + wordmark lockup. Used in auth pages, emails, print. Recommended: 1024×320 PNG.",
  },
  {
    key: "brand_name",
    label: "Brand Name",
    type: "text",
    default: "Euroscope",
    description: "The brand name shown in headers, metadata, and the PWA manifest.",
  },
  {
    key: "brand_tagline",
    label: "Tagline",
    type: "text",
    default: "Study in Europe. Start Your Future.",
    description: "Short tagline shown in the footer and hero.",
  },
  {
    key: "brand_primary_color",
    label: "Primary Brand Color",
    type: "color",
    default: "#D4AF37",
    description: "Primary brand color (gold). Used for accents, buttons, active states.",
  },
  {
    key: "contact_email",
    label: "Contact Email",
    type: "text",
    default: "hello@euroscope.app",
    description: "Primary contact email shown in the footer and contact page.",
  },
  {
    key: "contact_phone",
    label: "Contact Phone",
    type: "text",
    default: "+44 20 1234 5678",
    description: "Contact phone number shown in the footer.",
  },
];

const DEFAULTS_MAP = new Map(SETTING_DEFS.map((s) => [s.key, s]));

/**
 * Get all settings with their current values (from DB) or defaults.
 */
export async function getAllSettings(): Promise<SettingValue[]> {
  const rows = await prisma.siteSetting.findMany();
  const rowMap = new Map(rows.map((r) => [r.key, r]));

  return SETTING_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    type: def.type,
    value: rowMap.get(def.key)?.value ?? null,
    default: def.default,
    description: def.description,
  }));
}

/**
 * Get a single setting value. Returns the DB value if it exists,
 * otherwise the hardcoded default. Catches DB errors and returns
 * the default — the site must never crash because settings are
 * unavailable.
 */
export async function getSetting(key: string): Promise<string> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    if (row?.value) return row.value;
  } catch {
    // DB unavailable — fall through to default
  }
  return DEFAULTS_MAP.get(key)?.default ?? "";
}

/**
 * Get multiple settings at once (single DB round-trip). Catches DB
 * errors and returns defaults.
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } }).catch(() => []);
  const rowMap = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = rowMap.get(key) ?? DEFAULTS_MAP.get(key)?.default ?? "";
  }
  return result;
}

/**
 * Get all brand-related settings in a single call. Used by the
 * marketing layout to pass brand info to the navbar + footer.
 * Catches DB errors and returns defaults.
 */
export async function getBrandSettings() {
  const settings = await getSettings([
    "brand_logo",
    "brand_logo_light",
    "brand_logo_full",
    "brand_name",
    "brand_tagline",
    "brand_primary_color",
    "contact_email",
    "contact_phone",
  ]);
  return {
    logoUrl: settings.brand_logo,
    logoLightUrl: settings.brand_logo_light,
    logoFullUrl: settings.brand_logo_full,
    brandName: settings.brand_name,
    tagline: settings.brand_tagline,
    primaryColor: settings.brand_primary_color,
    contactEmail: settings.contact_email,
    contactPhone: settings.contact_phone,
  };
}

/**
 * Upsert a setting value. Called by the admin API when the user
 * saves the logo management form.
 */
export async function upsertSetting(
  key: string,
  value: string | null,
  actorId: string,
): Promise<void> {
  const def = DEFAULTS_MAP.get(key);
  if (!def) {
    throw new Error(`Unknown setting key: ${key}`);
  }

  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value, label: def.label, type: def.type, updatedById: actorId },
    update: { value, updatedById: actorId },
  });

  await auditLog.record({
    userId: actorId,
    action: "site_setting.updated",
    entity: "SiteSetting",
    entityId: key,
    newValue: { key, value },
  });
}

/**
 * Delete a setting (reverts to the hardcoded default).
 */
export async function deleteSetting(key: string, actorId: string): Promise<void> {
  await prisma.siteSetting.deleteMany({ where: { key } });
  await auditLog.record({
    userId: actorId,
    action: "site_setting.deleted",
    entity: "SiteSetting",
    entityId: key,
    oldValue: { key },
  });
}
