import { prisma } from "@/lib/db";
import { isEnvConfigured as isProcessEnvConfigured } from "./env-process";

/**
 * Environment Variable + DB Settings Health Checker
 * ===================================================
 *
 * The application has TWO sources of configuration:
 *
 * 1. process.env (true env vars)
 *    - DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL, CRON_SECRET
 *    - BACKUP_* (external storage credentials)
 *    - NEXT_PUBLIC_GA4_MEASUREMENT_ID, NEXT_PUBLIC_GTM_CONTAINER_ID,
 *      NEXT_PUBLIC_META_PIXEL_ID (public analytics IDs — set as env
 *      vars so they're available at build time)
 *
 * 2. SystemSetting (DB-stored, edited via /admin/settings)
 *    - email_server_host, email_server_port, email_server_user,
 *      email_server_password, email_from, email_from_name
 *    - company_name, company_email, etc.
 *
 * The Admin Settings page writes SMTP config to SystemSetting (DB),
 * NOT to process.env. So the System Operations → Configuration page
 * must check BOTH sources when reporting "Configured / Not Configured".
 *
 * Secrets are NEVER returned — only a boolean `configured` flag.
 */

export type EnvVarStatus = {
  key: string;
  label: string;
  category: string;
  configured: boolean;
  /** Source of the configuration: env | db | null */
  source?: "env" | "db" | null;
  /** Optional hint shown in the admin UI when not configured. */
  hint?: string;
  /** Whether the value is considered public (safe to display). */
  public?: boolean;
  /** For public values, the value itself (only when configured & public). */
  value?: string;
};

export type EnvCategory =
  | "Application"
  | "Database"
  | "Authentication"
  | "Email"
  | "Storage"
  | "Backup"
  | "Analytics"
  | "Tracking";

// ─── DB-stored setting keys (read from SystemSetting) ────────────
// Map our public label → the SystemSetting key the admin edits.
const DB_SETTING_KEYS: Array<{ dbKey: string; envKey: string; label: string; isSecret?: boolean }> = [
  // Email — these are stored in DB by /admin/settings → Email section
  { dbKey: "email_server_host", envKey: "EMAIL_SERVER_HOST", label: "SMTP host" },
  { dbKey: "email_server_port", envKey: "EMAIL_SERVER_PORT", label: "SMTP port" },
  { dbKey: "email_server_user", envKey: "EMAIL_SERVER_USER", label: "SMTP username" },
  { dbKey: "email_server_password", envKey: "EMAIL_SERVER_PASSWORD", label: "SMTP password", isSecret: true },
  { dbKey: "email_from", envKey: "EMAIL_FROM", label: "From address" },
];

// ─── process.env-only vars (NOT stored in DB) ─────────────────────
const PROCESS_ENV_VARS: Array<{
  key: string;
  label: string;
  category: EnvCategory;
  hint?: string;
  public?: boolean;
}> = [
  // Application
  { key: "DATABASE_URL", label: "MongoDB connection string", category: "Database" },
  { key: "AUTH_SECRET", label: "NextAuth secret", category: "Authentication" },
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "Public application URL",
    category: "Application",
    public: true,
  },
  {
    key: "NEXT_PUBLIC_APP_NAME",
    label: "Application name",
    category: "Application",
    public: true,
  },
  // Cron secret (production-only)
  {
    key: "CRON_SECRET",
    label: "Cron job secret",
    category: "Application",
    hint: "Protects /api/admin/system/*/cron endpoints. Required in production.",
  },
  // Backup
  {
    key: "BACKUP_STORAGE_PROVIDER",
    label: "Backup storage provider",
    category: "Backup",
    public: true,
    hint: "local | s3 | r2 | vercel-blob",
  },
  { key: "BACKUP_BUCKET", label: "Backup bucket", category: "Backup", public: true },
  { key: "BACKUP_REGION", label: "Backup region", category: "Backup", public: true },
  { key: "BACKUP_ENDPOINT", label: "Backup endpoint (R2/S3-compatible)", category: "Backup", public: true },
  { key: "BACKUP_ACCESS_KEY", label: "Backup access key", category: "Backup" },
  { key: "BACKUP_SECRET_KEY", label: "Backup secret key", category: "Backup" },
  // Analytics (public IDs — usually env vars so they're available at build)
  {
    key: "NEXT_PUBLIC_GA4_MEASUREMENT_ID",
    label: "GA4 Measurement ID",
    category: "Analytics",
    public: true,
    hint: "Format: G-XXXXXXXXXX. Also configurable via /admin/system/analytics.",
  },
  {
    key: "NEXT_PUBLIC_GTM_CONTAINER_ID",
    label: "GTM Container ID",
    category: "Analytics",
    public: true,
    hint: "Format: GTM-XXXXXXX. Also configurable via /admin/system/analytics.",
  },
  {
    key: "NEXT_PUBLIC_META_PIXEL_ID",
    label: "Meta Pixel ID",
    category: "Analytics",
    public: true,
    hint: "Numeric, ~15-16 digits. Also configurable via /admin/system/analytics.",
  },
];

const CATEGORY_ORDER: EnvCategory[] = [
  "Application",
  "Database",
  "Authentication",
  "Email",
  "Storage",
  "Backup",
  "Analytics",
  "Tracking",
];

// ─── DB settings cache (per-request) ──────────────────────────────
let dbSettingsCache: Map<string, string> | null = null;
let dbSettingsCacheTime = 0;
const DB_CACHE_TTL_MS = 30 * 1000; // 30s

async function loadDbSettings(): Promise<Map<string, string>> {
  const now = Date.now();
  if (dbSettingsCache && now - dbSettingsCacheTime < DB_CACHE_TTL_MS) {
    return dbSettingsCache;
  }
  const map = new Map<string, string>();
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: DB_SETTING_KEYS.map((d) => d.dbKey) } },
    });
    for (const r of rows) {
      if (r.value !== null && r.value !== undefined) {
        map.set(r.key, String(r.value));
      }
    }
  } catch {
    // DB unavailable — return empty map (will fall through to env check)
  }
  dbSettingsCache = map;
  dbSettingsCacheTime = now;
  return map;
}

/** Clear the in-process cache (used by tests + after admin settings save). */
export function __clearEnvCacheForTests(): void {
  dbSettingsCache = null;
  dbSettingsCacheTime = 0;
}

/**
 * Check whether a config key is configured — in either process.env OR
 * the SystemSetting table. Returns the source so the admin UI can show
 * "Configured via env var" vs "Configured via Settings page".
 */
export async function isConfigured(envKey: string): Promise<{
  configured: boolean;
  source: "env" | "db" | null;
}> {
  // Check env first
  if (isProcessEnvConfigured(envKey)) {
    return { configured: true, source: "env" };
  }
  // Check DB
  const dbKey = envKey.toLowerCase();
  const dbSettings = await loadDbSettings();
  const value = dbSettings.get(dbKey);
  if (value && value.trim().length > 0) {
    return { configured: true, source: "db" };
  }
  return { configured: false, source: null };
}

/** Synchronous env-only check (kept for backwards compat with health.ts). */
export function isEnvConfigured(key: string): boolean {
  return isProcessEnvConfigured(key);
}

/** Returns the status of every tracked config var (env + DB). Never returns raw secret values. */
export async function checkEnvironment(): Promise<{
  categories: Array<{
    name: EnvCategory;
    vars: EnvVarStatus[];
    configured: number;
    total: number;
  }>;
  totalConfigured: number;
  totalVars: number;
  missingCritical: string[];
}> {
  const dbSettings = await loadDbSettings();
  const byCategory = new Map<EnvCategory, EnvVarStatus[]>();
  const missingCritical: string[] = [];

  // Process env-only vars
  for (const def of PROCESS_ENV_VARS) {
    const raw = process.env[def.key];
    const configured = isProcessEnvConfigured(def.key);
    if (!configured && (def.category === "Database" || def.category === "Authentication")) {
      missingCritical.push(def.key);
    }
    const status: EnvVarStatus = {
      key: def.key,
      label: def.label,
      category: def.category,
      configured,
      source: configured ? "env" : null,
      hint: def.hint,
      public: def.public,
    };
    if (def.public && configured) status.value = raw;
    const arr = byCategory.get(def.category) ?? [];
    arr.push(status);
    byCategory.set(def.category, arr);
  }

  // DB-stored vars (Email section)
  for (const def of DB_SETTING_KEYS) {
    const envConfigured = isProcessEnvConfigured(def.envKey);
    const dbValue = dbSettings.get(def.dbKey);
    const dbConfigured = !!dbValue && dbValue.trim().length > 0;
    const configured = envConfigured || dbConfigured;
    const source: "env" | "db" | null = envConfigured ? "env" : dbConfigured ? "db" : null;
    const status: EnvVarStatus = {
      key: def.envKey,
      label: def.label,
      category: "Email",
      configured,
      source,
      hint: def.isSecret
        ? "Configured via /admin/settings → Email"
        : undefined,
    };
    if (def.isSecret) {
      // Never return secret values
    } else if (configured) {
      status.value = envConfigured ? process.env[def.envKey] : dbValue;
      status.public = true;
    }
    const arr = byCategory.get("Email") ?? [];
    arr.push(status);
    byCategory.set("Email", arr);
  }

  const categories = CATEGORY_ORDER.map((name) => {
    const vars = byCategory.get(name) ?? [];
    return {
      name,
      vars,
      configured: vars.filter((v) => v.configured).length,
      total: vars.length,
    };
  }).filter((c) => c.total > 0);

  const allVars = categories.flatMap((c) => c.vars);
  return {
    categories,
    totalConfigured: allVars.filter((v) => v.configured).length,
    totalVars: allVars.length,
    missingCritical,
  };
}
