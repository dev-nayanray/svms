/**
 * i18n architecture for the Employee panel.
 *
 * ── Status ────────────────────────────────────────────────────────────
 * This file establishes the architecture for a future full Bengali (bn)
 * translation. Bangla is declared as an available language in the
 * settings UI, but the strings themselves are NOT yet translated —
 * the `bn` dictionary is intentionally a stub that mirrors the `en`
 * dictionary's keys with empty-string values, so the type system
 * guarantees both dictionaries have the same shape.
 *
 * Until translations are complete, the UI falls back to `en` for any
 * missing key (see `t()` below). When the bn dictionary is filled in,
 * the fallback becomes invisible and the language toggle "just works".
 *
 * ── Architecture ──────────────────────────────────────────────────────
 *  1. Dictionary keys are statically typed via `TranslationKey` — adding
 *     a new key in `en` forces a corresponding entry in `bn`.
 *  2. The current language is stored server-side on `UserPreference`
 *     (per-user) and read in the layout. The client receives it as a
 *     prop and calls `t(key, lang)` to render strings.
 *  3. The architecture supports future server-side rendering in the
 *     user's language: pass `lang` from the layout to every server
 *     component, and `t()` becomes the single source of truth.
 *
 * ── Why this is "architecture, not feature" ──────────────────────────
 * We deliberately do NOT introduce partial translations. A half-
 * translated UI is worse than a fully-English one — users would see
 * mixed-language strings with no way to force English. So the bn
 * dictionary stays a stub until a complete translation pass is done.
 */

export const SUPPORTED_LANGUAGES = ["en", "bn"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, { label: string; nativeName: string }> = {
  en: { label: "English", nativeName: "English" },
  bn: { label: "Bangla", nativeName: "বাংলা" },
};

export const DEFAULT_LANGUAGE: Language = "en";

// ─── Dictionary ──────────────────────────────────────────────────────

/**
 * The English dictionary — the source of truth. Every key here MUST
 * have a corresponding (possibly empty) entry in the bn dictionary
 * below. The TypeScript `keyof typeof en` type enforces this.
 */
const en = {
  // Common
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.retry": "Retry",

  // Profile
  "profile.title": "My Profile",
  "profile.description": "Your employee record and contact details.",
  "profile.name": "Name",
  "profile.email": "Email",
  "profile.phone": "Phone",
  "profile.avatar": "Profile photo",
  "profile.title_field": "Title",
  "profile.branch": "Branch",
  "profile.designation": "Designation",
  "profile.address": "Address",
  "profile.role": "Role",
  "profile.status": "Status",
  "profile.lastLogin": "Last login",
  "profile.memberSince": "Member since",
  "profile.permissions": "Permissions",
  "profile.saved": "Profile saved",
  "profile.saveFailed": "Could not save profile",

  // Settings
  "settings.title": "Settings",
  "settings.description": "Workspace preferences, notifications, and account security.",
  "settings.notifications": "Notifications",
  "settings.appearance": "Appearance",
  "settings.language": "Language",
  "settings.privacy": "Privacy",
  "settings.security": "Security",
  "settings.help": "Help",
  "settings.saved": "Settings saved",

  // Theme
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",

  // Security
  "security.changePassword": "Change password",
  "security.currentPassword": "Current password",
  "security.newPassword": "New password",
  "security.confirmPassword": "Confirm new password",
  "security.passwordChanged": "Password changed",
  "security.sessions": "Active sessions",
  "security.logoutAll": "Sign out everywhere",
} as const;

export type TranslationKey = keyof typeof en;

/**
 * The Bengali dictionary. INTENTIONALLY A STUB — keys mirror `en` so
 * the type system catches drift, but values are empty strings. When
 * a translator fills these in, the language toggle becomes live with
 * zero code changes.
 */
const bn: Record<TranslationKey, string> = {
  "common.save": "",
  "common.cancel": "",
  "common.back": "",
  "common.loading": "",
  "common.error": "",
  "common.retry": "",

  "profile.title": "",
  "profile.description": "",
  "profile.name": "",
  "profile.email": "",
  "profile.phone": "",
  "profile.avatar": "",
  "profile.title_field": "",
  "profile.branch": "",
  "profile.designation": "",
  "profile.address": "",
  "profile.role": "",
  "profile.status": "",
  "profile.lastLogin": "",
  "profile.memberSince": "",
  "profile.permissions": "",
  "profile.saved": "",
  "profile.saveFailed": "",

  "settings.title": "",
  "settings.description": "",
  "settings.notifications": "",
  "settings.appearance": "",
  "settings.language": "",
  "settings.privacy": "",
  "settings.security": "",
  "settings.help": "",
  "settings.saved": "",

  "theme.system": "",
  "theme.light": "",
  "theme.dark": "",

  "security.changePassword": "",
  "security.currentPassword": "",
  "security.newPassword": "",
  "security.confirmPassword": "",
  "security.passwordChanged": "",
  "security.sessions": "",
  "security.logoutAll": "",
};

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, bn };

/**
 * Translate a key in the given language. Falls back to English when
 * the translation is missing (empty string in the bn dictionary).
 *
 * Pure function — safe to call from server components, client
 * components, and tests.
 */
export function t(key: TranslationKey, lang: Language = DEFAULT_LANGUAGE): string {
  const dict = dictionaries[lang] ?? dictionaries[DEFAULT_LANGUAGE];
  const value = dict[key];
  // Empty string = "not yet translated" → fall back to English.
  if (!value) return dictionaries[DEFAULT_LANGUAGE][key];
  return value;
}

/**
 * Returns true if a complete translation exists for the given language.
 * Used by the settings UI to show a "translation in progress" hint
 * next to the language selector.
 */
export function isTranslationComplete(lang: Language): boolean {
  if (lang === DEFAULT_LANGUAGE) return true;
  const dict = dictionaries[lang];
  return Object.values(dict).every((v) => v.length > 0);
}
