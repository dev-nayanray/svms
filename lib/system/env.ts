/**
 * Environment Variable Health Checker
 * ===================================
 *
 * Reads `process.env` at request time to determine which required
 * and optional variables are present. NEVER returns the value — only
 * a boolean `configured` flag. This is the single source of truth
 * for "is X configured?" in the Admin UI.
 *
 * Secrets handled here:
 *   - DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL
 *   - EMAIL_SERVER / EMAIL_FROM (nodemailer)
 *   - BACKUP_BUCKET / BACKUP_REGION / BACKUP_ENDPOINT /
 *     BACKUP_ACCESS_KEY / BACKUP_SECRET_KEY
 *   - GA4 / GTM / Meta Pixel (these are PUBLIC IDs, but listed here
 *     for completeness — they're read by the analytics module).
 */

export type EnvVarStatus = {
  key: string;
  label: string;
  category: string;
  configured: boolean;
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

const REQUIRED_VARS: Array<{
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
  // Email
  {
    key: "EMAIL_SERVER_HOST",
    label: "SMTP host",
    category: "Email",
    hint: "Used by nodemailer to send transactional emails.",
  },
  { key: "EMAIL_SERVER_PORT", label: "SMTP port", category: "Email" },
  { key: "EMAIL_SERVER_USER", label: "SMTP username", category: "Email" },
  { key: "EMAIL_SERVER_PASSWORD", label: "SMTP password", category: "Email" },
  { key: "EMAIL_FROM", label: "From address", category: "Email", public: true },
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
  // Analytics
  {
    key: "NEXT_PUBLIC_GA4_MEASUREMENT_ID",
    label: "GA4 Measurement ID",
    category: "Analytics",
    public: true,
    hint: "Format: G-XXXXXXXXXX",
  },
  {
    key: "NEXT_PUBLIC_GTM_CONTAINER_ID",
    label: "GTM Container ID",
    category: "Analytics",
    public: true,
    hint: "Format: GTM-XXXXXXX",
  },
  {
    key: "NEXT_PUBLIC_META_PIXEL_ID",
    label: "Meta Pixel ID",
    category: "Analytics",
    public: true,
    hint: "Numeric, ~15-16 digits",
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

/** Returns the status of every tracked env var. Never returns raw secret values. */
export function checkEnvironment(): {
  categories: Array<{
    name: EnvCategory;
    vars: EnvVarStatus[];
    configured: number;
    total: number;
  }>;
  totalConfigured: number;
  totalVars: number;
  missingCritical: string[];
} {
  const byCategory = new Map<EnvCategory, EnvVarStatus[]>();
  const missingCritical: string[] = [];

  for (const def of REQUIRED_VARS) {
    const raw = process.env[def.key];
    const configured = !!raw && raw.trim().length > 0 && raw.trim() !== "change-me-to-a-random-32-char-string";
    if (!configured && (def.category === "Database" || def.category === "Authentication")) {
      missingCritical.push(def.key);
    }
    const status: EnvVarStatus = {
      key: def.key,
      label: def.label,
      category: def.category,
      configured,
      hint: def.hint,
      public: def.public,
    };
    if (def.public && configured) status.value = raw;
    const arr = byCategory.get(def.category) ?? [];
    arr.push(status);
    byCategory.set(def.category, arr);
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

/** Convenience: returns true if a given env var is set to a non-empty, non-placeholder value. */
export function isEnvConfigured(key: string): boolean {
  const raw = process.env[key];
  return !!raw && raw.trim().length > 0 && raw.trim() !== "change-me-to-a-random-32-char-string";
}
