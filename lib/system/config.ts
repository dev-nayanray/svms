import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * System Configuration Store
 * ==========================
 *
 * Reuses the existing SystemSetting model (key → JSON value) to back
 * the Admin → System Administration → Configuration module.
 *
 * Naming convention: keys are dotted paths grouped by domain:
 *   "backup.provider"          "backup.encryption"
 *   "seo.defaultOgImage"       "seo.locale"
 *   "analytics.ga4.measurementId"
 *   "analytics.gtm.containerId"
 *   "analytics.meta.pixelId"
 *   "tracking.consent.required"
 *   "maintenance.message"
 *
 * Secrets are NEVER stored here — they live in environment variables
 * only (BACKUP_ACCESS_KEY, AUTH_SECRET, etc.). The config store holds
 * only non-secret configuration: enabled flags, IDs, schedules,
 * public URLs, retention counts.
 *
 * For secrets the UI shows "Configured" / "Not Configured" by reading
 * `process.env` at request time (see env.ts → checkEnvironment()).
 */

export type SystemConfig = Record<string, unknown>;

// ─── Default configuration ────────────────────────────────────────
// Applied when no DB row exists yet. Admins override per-key.
const DEFAULTS: SystemConfig = {
  "backup.provider": "local",
  "backup.encryption": true,
  "backup.retentionDaily": 7,
  "backup.retentionWeekly": 4,
  "backup.retentionMonthly": 12,
  "backup.maxCount": 50,
  "backup.autoEnabled": false,
  "backup.defaultScope": ["*"],

  "seo.siteName": "Euroscope",
  "seo.titleTemplate": "%s | Euroscope",
  "seo.metaDescription":
    "Euroscope — Study in Europe. Apply to leading universities and manage your student visa journey in one place.",
  "seo.locale": "en_US",
  "seo.language": "en",
  "seo.defaultOgImage": "/euroscope-logo-full.png",
  "seo.defaultTwitterImage": "/euroscope-logo-full.png",
  "seo.canonicalBase": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  "seo.indexPrivateRoutes": false,

  "analytics.ga4.enabled": false,
  "analytics.ga4.measurementId": "",
  "analytics.gtm.enabled": false,
  "analytics.gtm.containerId": "",
  "analytics.meta.enabled": false,
  "analytics.meta.pixelId": "",
  "analytics.vercelAnalytics.enabled": true,
  "analytics.vercelSpeedInsights.enabled": true,

  "tracking.consent.required": true,
  "tracking.consent.default": "necessary",
  "tracking.events.pageView": true,
  "tracking.events.contactSubmit": true,
  "tracking.events.counselingRequest": true,
  "tracking.events.applicationStarted": true,
  "tracking.events.applicationSubmitted": true,

  "maintenance.message":
    "We are performing scheduled maintenance. Euroscope will be back shortly. Thank you for your patience.",
  "maintenance.allowAdminAccess": true,
};

const cache = new Map<string, unknown>();
let cacheHydrated = false;

async function hydrateCache(): Promise<void> {
  if (cacheHydrated) return;
  try {
    const rows = await prisma.systemSetting.findMany();
    for (const row of rows) {
      cache.set(row.key, row.value as unknown);
    }
    cacheHydrated = true;
  } catch {
    // DB not available — defaults will be used.
    cacheHydrated = true;
  }
}

/** Get a single config value (merged with default). */
export async function getConfig<T = unknown>(key: string): Promise<T | undefined> {
  await hydrateCache();
  if (cache.has(key)) return cache.get(key) as T;
  return DEFAULTS[key] as T;
}

/** Get a batch of config values (single DB round-trip if cache miss). */
export async function getConfigs(keys: string[]): Promise<Record<string, unknown>> {
  await hydrateCache();
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    result[key] = cache.has(key) ? cache.get(key) : DEFAULTS[key];
  }
  return result;
}

/** Get all config keys (defaults + DB overrides) — used by the admin UI. */
export async function getAllConfig(): Promise<Record<string, unknown>> {
  await hydrateCache();
  return { ...DEFAULTS, ...Object.fromEntries(cache) };
}

/** Upsert a config value (admin only). Clears cache for the key. */
export async function setConfig(
  key: string,
  value: unknown,
  actorId?: string,
): Promise<void> {
  // Defensive — never let a secret-looking key be persisted.
  if (/secret|password|token|api[_-]?key/i.test(key) && typeof value === "string" && value.length > 0) {
    throw new Error(
      `Refusing to persist potential secret to config store (key="${key}"). Use an environment variable instead.`,
    );
  }
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
  cache.set(key, value);
  void actorId;
}

/** Delete a config key (revert to default). */
export async function deleteConfig(key: string): Promise<void> {
  await prisma.systemSetting.deleteMany({ where: { key } });
  cache.delete(key);
}

/** Clear the in-process cache (used by tests). */
export function __clearConfigCacheForTests(): void {
  cache.clear();
  cacheHydrated = false;
}

// ─── Domain helpers ────────────────────────────────────────────────

export type BackupConfig = {
  provider: string;
  encryption: boolean;
  retentionDaily: number;
  retentionWeekly: number;
  retentionMonthly: number;
  maxCount: number;
  autoEnabled: boolean;
  defaultScope: string[];
};

export async function getBackupConfig(): Promise<BackupConfig> {
  const c = await getConfigs([
    "backup.provider",
    "backup.encryption",
    "backup.retentionDaily",
    "backup.retentionWeekly",
    "backup.retentionMonthly",
    "backup.maxCount",
    "backup.autoEnabled",
    "backup.defaultScope",
  ]);
  return {
    provider: String(c["backup.provider"] ?? "local"),
    encryption: Boolean(c["backup.encryption"] ?? true),
    retentionDaily: Number(c["backup.retentionDaily"] ?? 7),
    retentionWeekly: Number(c["backup.retentionWeekly"] ?? 4),
    retentionMonthly: Number(c["backup.retentionMonthly"] ?? 12),
    maxCount: Number(c["backup.maxCount"] ?? 50),
    autoEnabled: Boolean(c["backup.autoEnabled"] ?? false),
    defaultScope: Array.isArray(c["backup.defaultScope"])
      ? (c["backup.defaultScope"] as string[])
      : ["*"],
  };
}

export type SeoConfig = {
  siteName: string;
  titleTemplate: string;
  metaDescription: string;
  locale: string;
  language: string;
  defaultOgImage: string;
  defaultTwitterImage: string;
  canonicalBase: string;
  indexPrivateRoutes: boolean;
};

export async function getSeoConfig(): Promise<SeoConfig> {
  const c = await getConfigs([
    "seo.siteName",
    "seo.titleTemplate",
    "seo.metaDescription",
    "seo.locale",
    "seo.language",
    "seo.defaultOgImage",
    "seo.defaultTwitterImage",
    "seo.canonicalBase",
    "seo.indexPrivateRoutes",
  ]);
  return {
    siteName: String(c["seo.siteName"] ?? "Euroscope"),
    titleTemplate: String(c["seo.titleTemplate"] ?? "%s | Euroscope"),
    metaDescription: String(c["seo.metaDescription"] ?? ""),
    locale: String(c["seo.locale"] ?? "en_US"),
    language: String(c["seo.language"] ?? "en"),
    defaultOgImage: String(c["seo.defaultOgImage"] ?? ""),
    defaultTwitterImage: String(c["seo.defaultTwitterImage"] ?? ""),
    canonicalBase: String(c["seo.canonicalBase"] ?? process.env.NEXT_PUBLIC_APP_URL ?? ""),
    indexPrivateRoutes: Boolean(c["seo.indexPrivateRoutes"] ?? false),
  };
}

export type AnalyticsConfig = {
  ga4: { enabled: boolean; measurementId: string };
  gtm: { enabled: boolean; containerId: string };
  meta: { enabled: boolean; pixelId: string };
  vercelAnalytics: { enabled: boolean };
  vercelSpeedInsights: { enabled: boolean };
};

export async function getAnalyticsConfig(): Promise<AnalyticsConfig> {
  const c = await getConfigs([
    "analytics.ga4.enabled",
    "analytics.ga4.measurementId",
    "analytics.gtm.enabled",
    "analytics.gtm.containerId",
    "analytics.meta.enabled",
    "analytics.meta.pixelId",
    "analytics.vercelAnalytics.enabled",
    "analytics.vercelSpeedInsights.enabled",
  ]);
  return {
    ga4: {
      enabled: Boolean(c["analytics.ga4.enabled"]),
      measurementId: String(c["analytics.ga4.measurementId"] ?? ""),
    },
    gtm: {
      enabled: Boolean(c["analytics.gtm.enabled"]),
      containerId: String(c["analytics.gtm.containerId"] ?? ""),
    },
    meta: {
      enabled: Boolean(c["analytics.meta.enabled"]),
      pixelId: String(c["analytics.meta.pixelId"] ?? ""),
    },
    vercelAnalytics: { enabled: Boolean(c["analytics.vercelAnalytics.enabled"]) },
    vercelSpeedInsights: { enabled: Boolean(c["analytics.vercelSpeedInsights.enabled"]) },
  };
}

export type TrackingConsent = {
  required: boolean;
  default: string;
  events: Record<string, boolean>;
};

export async function getTrackingConsent(): Promise<TrackingConsent> {
  const c = await getConfigs([
    "tracking.consent.required",
    "tracking.consent.default",
    "tracking.events.pageView",
    "tracking.events.contactSubmit",
    "tracking.events.counselingRequest",
    "tracking.events.applicationStarted",
    "tracking.events.applicationSubmitted",
  ]);
  return {
    required: Boolean(c["tracking.consent.required"]),
    default: String(c["tracking.consent.default"] ?? "necessary"),
    events: {
      pageView: Boolean(c["tracking.events.pageView"]),
      contactSubmit: Boolean(c["tracking.events.contactSubmit"]),
      counselingRequest: Boolean(c["tracking.events.counselingRequest"]),
      applicationStarted: Boolean(c["tracking.events.applicationStarted"]),
      applicationSubmitted: Boolean(c["tracking.events.applicationSubmitted"]),
    },
  };
}
