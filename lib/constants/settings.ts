/**
 * Pure helpers for the Admin Settings module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The setting sections, keys, defaults, and secret-masking logic
 * are the single source of truth.
 *
 * Security: sensitive settings (API keys, passwords, secrets) are
 * masked in the GET response — the UI never sees the full value. The
 * PUT endpoint accepts a new value and stores it, but the GET response
 * always returns "••••••" for secret keys. This prevents accidental
 * exposure of secrets in the browser.
 */

export type SettingSection = {
  key: string;
  label: string;
  icon: string;
  description: string;
  settings: SettingDef[];
};

export type SettingDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "password";
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  isSecret?: boolean;
  helpText?: string;
};

export const SETTING_SECTIONS: SettingSection[] = [
  // ── Company ──
  {
    key: "company",
    label: "Company",
    icon: "Building2",
    description: "Organization name, logo, and contact details.",
    settings: [
      { key: "company_name", label: "Company name", type: "text", placeholder: "Badhan Education Consultancy", defaultValue: "" },
      { key: "company_logo", label: "Logo URL", type: "text", placeholder: "https://…/logo.png", defaultValue: "" },
      { key: "company_email", label: "Company email", type: "text", placeholder: "info@example.com", defaultValue: "" },
      { key: "company_phone", label: "Company phone", type: "text", placeholder: "+880 …", defaultValue: "" },
      { key: "company_address", label: "Company address", type: "textarea", placeholder: "Dhaka, Bangladesh", defaultValue: "" },
    ],
  },
  // ── Branches ──
  {
    key: "branches",
    label: "Branches",
    icon: "GitBranch",
    description: "Default branch settings and multi-branch configuration.",
    settings: [
      { key: "default_branch_code", label: "Default branch code", type: "text", placeholder: "HQ", defaultValue: "HQ" },
      { key: "multi_branch_enabled", label: "Multi-branch access control", type: "boolean", defaultValue: false, helpText: "When enabled, employees only see data from their assigned branch." },
    ],
  },
  // ── Application Workflow ──
  {
    key: "workflow",
    label: "Application Workflow",
    icon: "FolderKanban",
    description: "Application pipeline stages and default stage.",
    settings: [
      { key: "default_application_stage", label: "Default application stage", type: "text", defaultValue: "LEAD", helpText: "The stage new applications start at." },
      { key: "auto_advance_stages", label: "Auto-advance stages", type: "boolean", defaultValue: false, helpText: "When enabled, applications auto-advance to the next stage after document approval." },
    ],
  },
  // ── Document Requirements ──
  {
    key: "documents",
    label: "Document Requirements",
    icon: "FileText",
    description: "Default document settings.",
    settings: [
      { key: "document_expiry_warning_days", label: "Expiry warning (days)", type: "number", defaultValue: 30, helpText: "Warn N days before a document expires." },
      { key: "max_document_size_mb", label: "Max document size (MB)", type: "number", defaultValue: 10 },
      { key: "allowed_document_types", label: "Allowed document types", type: "text", placeholder: "pdf,jpeg,png,webp", defaultValue: "pdf,jpeg,png,webp" },
    ],
  },
  // ── Visa Requirements ──
  {
    key: "visa",
    label: "Visa Requirements",
    icon: "Stamp",
    description: "Visa application settings.",
    settings: [
      { key: "visa_processing_buffer_days", label: "Processing buffer (days)", type: "number", defaultValue: 90, helpText: "Minimum days between visa submission and intake start." },
      { key: "auto_create_visa_record", label: "Auto-create visa record", type: "boolean", defaultValue: true, helpText: "When an application reaches VISA_PREPARATION, auto-create the visa record." },
    ],
  },
  // ── Countries ──
  {
    key: "countries",
    label: "Countries",
    icon: "Globe",
    description: "Default country and currency settings.",
    settings: [
      { key: "default_currency", label: "Default currency", type: "select", defaultValue: "BDT", options: [
        { value: "BDT", label: "Bangladeshi Taka (BDT)" },
        { value: "USD", label: "US Dollar (USD)" },
        { value: "GBP", label: "British Pound (GBP)" },
        { value: "EUR", label: "Euro (EUR)" },
        { value: "AUD", label: "Australian Dollar (AUD)" },
        { value: "CAD", label: "Canadian Dollar (CAD)" },
      ] },
      { key: "invoice_prefix", label: "Invoice prefix", type: "text", defaultValue: "INV" },
      { key: "timezone", label: "Timezone", type: "select", defaultValue: "Asia/Dhaka", options: [
        { value: "Asia/Dhaka", label: "Asia/Dhaka (GMT+6)" },
        { value: "UTC", label: "UTC" },
        { value: "Europe/London", label: "Europe/London (GMT+0/+1)" },
        { value: "America/New_York", label: "America/New_York (GMT-5/-4)" },
      ] },
    ],
  },
  // ── Notifications ──
  {
    key: "notifications",
    label: "Notifications",
    icon: "Bell",
    description: "Notification preferences and email triggers.",
    settings: [
      { key: "notif_document_events", label: "Document events", type: "boolean", defaultValue: true, helpText: "Notify on document upload/approve/reject." },
      { key: "notif_application_events", label: "Application stage changes", type: "boolean", defaultValue: true },
      { key: "notif_task_events", label: "Task assignments", type: "boolean", defaultValue: true },
      { key: "notif_payment_events", label: "Payment events", type: "boolean", defaultValue: true },
      { key: "notif_visa_events", label: "Visa status changes", type: "boolean", defaultValue: true },
      { key: "notif_message_events", label: "New messages", type: "boolean", defaultValue: true },
    ],
  },
  // ── Email ──
  {
    key: "email",
    label: "Email",
    icon: "Mail",
    description: "Email server configuration. Secrets are masked in the UI.",
    settings: [
      { key: "email_from", label: "From address", type: "text", placeholder: "noreply@example.com", defaultValue: "" },
      { key: "email_from_name", label: "From name", type: "text", placeholder: "SVMS System", defaultValue: "" },
      { key: "email_server_host", label: "SMTP host", type: "text", placeholder: "smtp.gmail.com", defaultValue: "" },
      { key: "email_server_port", label: "SMTP port", type: "number", placeholder: "587", defaultValue: 587 },
      { key: "email_server_user", label: "SMTP username", type: "text", placeholder: "user@example.com", defaultValue: "" },
      { key: "email_server_password", label: "SMTP password", type: "password", isSecret: true, placeholder: "••••••••", defaultValue: "" },
    ],
  },
  // ── Payments ──
  {
    key: "payments",
    label: "Payments",
    icon: "CreditCard",
    description: "Payment methods and gateway configuration. Secrets are masked.",
    settings: [
      { key: "payment_methods_enabled", label: "Enabled payment methods", type: "text", placeholder: "CASH,BANK_TRANSFER,BKASH,NAGAD,CARD", defaultValue: "CASH,BANK_TRANSFER,BKASH,NAGAD,CARD,OTHER" },
      { key: "bkash_merchant_key", label: "bKash merchant key", type: "password", isSecret: true, placeholder: "••••••••", defaultValue: "" },
      { key: "nagad_merchant_key", label: "Nagad merchant key", type: "password", isSecret: true, placeholder: "••••••••", defaultValue: "" },
      { key: "stripe_secret_key", label: "Stripe secret key", type: "password", isSecret: true, placeholder: "••••••••", defaultValue: "" },
      { key: "stripe_publishable_key", label: "Stripe publishable key", type: "text", placeholder: "pk_live_…", defaultValue: "" },
    ],
  },
  // ── Security ──
  {
    key: "security",
    label: "Security",
    icon: "ShieldCheck",
    description: "Session configuration, password policies, and security preferences.",
    settings: [
      { key: "session_timeout_minutes", label: "Session timeout (minutes)", type: "number", defaultValue: 60, helpText: "JWT session expiry in minutes." },
      { key: "password_min_length", label: "Minimum password length", type: "number", defaultValue: 8 },
      { key: "password_require_uppercase", label: "Require uppercase", type: "boolean", defaultValue: true },
      { key: "password_require_lowercase", label: "Require lowercase", type: "boolean", defaultValue: true },
      { key: "password_require_number", label: "Require number", type: "boolean", defaultValue: true },
      { key: "password_require_special", label: "Require special character", type: "boolean", defaultValue: false },
      { key: "max_login_attempts", label: "Max login attempts", type: "number", defaultValue: 5, helpText: "Account lockout threshold before reset." },
      { key: "lockout_duration_minutes", label: "Lockout duration (minutes)", type: "number", defaultValue: 15 },
    ],
  },
  // ── System ──
  {
    key: "system",
    label: "System",
    icon: "Settings",
    description: "System-level configuration. These settings are read-only in the UI.",
    settings: [
      { key: "system_version", label: "System version", type: "text", defaultValue: "0.1.0", helpText: "Read-only — reflects package.json version." },
      { key: "system_database", label: "Database", type: "text", defaultValue: "MongoDB", helpText: "Read-only — database provider." },
      { key: "system_environment", label: "Environment", type: "text", defaultValue: "development", helpText: "Read-only — NODE_ENV." },
    ],
  },
];

/** Mask value for secrets — never expose the real value in GET responses. */
export const SECRET_MASK = "••••••••";

/** Keys that should never be exposed in full in the API response. */
export const SECRET_KEYS = SETTING_SECTIONS
  .flatMap((s) => s.settings)
  .filter((s) => s.isSecret)
  .map((s) => s.key);

/**
 * Returns true if the given setting key is a secret (should be masked
 * in GET responses).
 */
export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.includes(key);
}

/**
 * Mask a setting value if it's a secret. Returns the original value for
 * non-secret keys, and SECRET_MASK for secret keys that have a non-empty
 * value. Empty/undefined secret values are returned as empty string.
 */
export function maskSecretValue(key: string, value: unknown): unknown {
  if (!isSecretKey(key)) return value;
  if (value == null || value === "") return "";
  return SECRET_MASK;
}

/**
 * Returns the section that a setting key belongs to.
 */
export function getSettingSection(key: string): SettingSection | null {
  for (const section of SETTING_SECTIONS) {
    if (section.settings.some((s) => s.key === key)) return section;
  }
  return null;
}

/**
 * Returns all setting keys across all sections, in section order.
 */
export function getAllSettingKeys(): string[] {
  return SETTING_SECTIONS.flatMap((s) => s.settings.map((set) => set.key));
}

/**
 * Returns the default value for a setting key.
 */
export function getDefaultValue(key: string): unknown {
  for (const section of SETTING_SECTIONS) {
    const setting = section.settings.find((s) => s.key === key);
    if (setting) return setting.defaultValue;
  }
  return undefined;
}

/**
 * Returns true if a setting key is read-only (system section).
 */
export function isReadOnly(key: string): boolean {
  const section = getSettingSection(key);
  return section?.key === "system";
}
