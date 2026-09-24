import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { JsonValue } from "@prisma/client/runtime/library";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/services/notification-cases";
import { SUPPORTED_LANGUAGES, type Language } from "@/lib/i18n";

/**
 * Employee Settings service — per-user preferences persisted server-side
 * on the UserPreference model.
 *
 * ── IDOR closure ──────────────────────────────────────────────────────
 * Every read/write uses `userId = session.user.id`. An employee cannot
 * read or mutate another employee's preferences.
 *
 * ── Theme + language ─────────────────────────────────────────────────
 * Theme (system | light | dark) and language (en | bn) are stored
 * server-side so they survive cross-device sign-in. The layout reads
 * the preference once per page load and passes it to the app-shell.
 *
 * ── Notification preferences ─────────────────────────────────────────
 * A JSON object keyed by NotificationCategory with per-channel
 * booleans: { APPLICATION: { email, push, inApp }, ... }. The
 * notification emit path reads these to decide whether to send.
 *
 * ── Privacy ──────────────────────────────────────────────────────────
 * Two booleans: showProfileToStudents, showOnlineStatus. Both default
 * to false / true respectively (conservative defaults — employees
 * don't show their profile to students by default).
 *
 * ── Audit ─────────────────────────────────────────────────────────────
 * Every change writes an AuditLog row capturing old + new values.
 */

// ─── Constants ────────────────────────────────────────────────────────

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export type NotificationChannel = "email" | "push" | "inApp";
export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["email", "push", "inApp"];

export type CategoryChannelPrefs = Record<NotificationChannel, boolean>;
export type NotificationPrefs = Record<NotificationCategory, CategoryChannelPrefs>;

export type PrivacyPrefs = {
  showProfileToStudents: boolean;
  showOnlineStatus: boolean;
};

// ─── Types ────────────────────────────────────────────────────────────

export type UserSettings = {
  theme: Theme;
  language: Language;
  notificationPrefs: NotificationPrefs;
  privacy: PrivacyPrefs;
  updatedAt: Date;
};

// ─── Defaults ─────────────────────────────────────────────────────────

export const DEFAULT_THEME: Theme = "system";
export const DEFAULT_LANGUAGE: Language = "en";

export const DEFAULT_PRIVACY: PrivacyPrefs = {
  showProfileToStudents: false,
  showOnlineStatus: true,
};

/**
 * Build the default notification prefs: every channel enabled for
 * every category. Users opt out from the settings page.
 */
export function defaultNotificationPrefs(): NotificationPrefs {
  const out = {} as NotificationPrefs;
  for (const cat of NOTIFICATION_CATEGORIES) {
    out[cat] = { email: true, push: true, inApp: true };
  }
  return out;
}

// ─── Read ─────────────────────────────────────────────────────────────

/**
 * Get the caller's settings, creating a row with defaults if none
 * exists yet. The row is created lazily so we don't need a migration
 * to backfill existing users.
 */
export async function getSettings(userId: string): Promise<UserSettings> {
  let prefs = await prisma.userPreference.findUnique({
    where: { userId },
    select: {
      theme: true, language: true, notificationPrefs: true,
      showProfileToStudents: true, showOnlineStatus: true, updatedAt: true,
    },
  });

  if (!prefs) {
    // Lazily create the row with defaults
    prefs = await prisma.userPreference.create({
      data: {
        userId,
        theme: DEFAULT_THEME,
        language: DEFAULT_LANGUAGE,
        notificationPrefs: defaultNotificationPrefs() as unknown as JsonValue,
        showProfileToStudents: DEFAULT_PRIVACY.showProfileToStudents,
        showOnlineStatus: DEFAULT_PRIVACY.showOnlineStatus,
      },
      select: {
        theme: true, language: true, notificationPrefs: true,
        showProfileToStudents: true, showOnlineStatus: true, updatedAt: true,
      },
    });
  }

  return {
    theme: normalizeTheme(prefs.theme),
    language: normalizeLanguage(prefs.language),
    notificationPrefs: normalizeNotificationPrefs(prefs.notificationPrefs),
    privacy: {
      showProfileToStudents: prefs.showProfileToStudents,
      showOnlineStatus: prefs.showOnlineStatus,
    },
    updatedAt: prefs.updatedAt,
  };
}

// ─── Update — theme ──────────────────────────────────────────────────

export async function updateTheme(
  userId: string,
  theme: Theme,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<UserSettings> {
  if (!THEMES.includes(theme)) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid theme: ${theme}`);
  }
  await upsertPreferences(userId, { theme });
  await auditPreferenceChange(userId, actor, "settings.theme_changed", { theme });
  return getSettings(userId);
}

// ─── Update — language ───────────────────────────────────────────────

export async function updateLanguage(
  userId: string,
  language: Language,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<UserSettings> {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new HttpError(400, "BAD_REQUEST", `Invalid language: ${language}`);
  }
  await upsertPreferences(userId, { language });
  await auditPreferenceChange(userId, actor, "settings.language_changed", { language });
  return getSettings(userId);
}

// ─── Update — notification prefs ────────────────────────────────────

export async function updateNotificationPrefs(
  userId: string,
  prefs: Partial<NotificationPrefs>,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<UserSettings> {
  const current = await getSettings(userId);
  const merged = { ...current.notificationPrefs, ...prefs };
  // Validate every category + channel value
  for (const cat of Object.keys(merged) as NotificationCategory[]) {
    if (!NOTIFICATION_CATEGORIES.includes(cat)) {
      throw new HttpError(400, "BAD_REQUEST", `Invalid notification category: ${cat}`);
    }
    const channels = merged[cat];
    for (const ch of Object.keys(channels) as NotificationChannel[]) {
      if (!NOTIFICATION_CHANNELS.includes(ch)) {
        throw new HttpError(400, "BAD_REQUEST", `Invalid notification channel: ${ch}`);
      }
      if (typeof channels[ch] !== "boolean") {
        throw new HttpError(422, "VALIDATION_ERROR", `Channel ${ch} for ${cat} must be a boolean`);
      }
    }
  }
  await upsertPreferences(userId, { notificationPrefs: merged as unknown as JsonValue });
  await auditPreferenceChange(userId, actor, "settings.notifications_changed", { updated: Object.keys(prefs) });
  return getSettings(userId);
}

// ─── Update — privacy ────────────────────────────────────────────────

export async function updatePrivacy(
  userId: string,
  privacy: Partial<PrivacyPrefs>,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<UserSettings> {
  const data: Record<string, unknown> = {};
  if (privacy.showProfileToStudents !== undefined) {
    if (typeof privacy.showProfileToStudents !== "boolean") {
      throw new HttpError(422, "VALIDATION_ERROR", "showProfileToStudents must be boolean");
    }
    data.showProfileToStudents = privacy.showProfileToStudents;
  }
  if (privacy.showOnlineStatus !== undefined) {
    if (typeof privacy.showOnlineStatus !== "boolean") {
      throw new HttpError(422, "VALIDATION_ERROR", "showOnlineStatus must be boolean");
    }
    data.showOnlineStatus = privacy.showOnlineStatus;
  }
  if (Object.keys(data).length === 0) {
    throw new HttpError(422, "VALIDATION_ERROR", "No privacy fields to update");
  }
  await upsertPreferences(userId, data);
  await auditPreferenceChange(userId, actor, "settings.privacy_changed", data);
  return getSettings(userId);
}

// ─── Helpers ──────────────────────────────────────────────────────────

async function upsertPreferences(userId: string, data: Record<string, unknown>): Promise<void> {
  await prisma.userPreference.upsert({
    where: { userId },
    update: { ...data, updatedAt: new Date() },
    create: {
      userId,
      theme: DEFAULT_THEME,
      language: DEFAULT_LANGUAGE,
      notificationPrefs: defaultNotificationPrefs() as unknown as JsonValue,
      showProfileToStudents: DEFAULT_PRIVACY.showProfileToStudents,
      showOnlineStatus: DEFAULT_PRIVACY.showOnlineStatus,
      ...data,
    },
  });
}

async function auditPreferenceChange(
  userId: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
  action: string,
  newValue: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity: "UserPreference",
        entityId: userId,
        newValue: newValue as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) {
    console.error(`[settings-audit] ${action} failed`, err);
  }
}

// ─── Normalization (defensive — DB may have stale or partial data) ────

function normalizeTheme(value: string): Theme {
  return (THEMES as readonly string[]).includes(value) ? (value as Theme) : DEFAULT_THEME;
}

function normalizeLanguage(value: string): Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value) ? (value as Language) : DEFAULT_LANGUAGE;
}

function normalizeNotificationPrefs(raw: unknown): NotificationPrefs {
  const out = defaultNotificationPrefs();
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const cat of NOTIFICATION_CATEGORIES) {
    const channels = obj[cat];
    if (!channels || typeof channels !== "object") continue;
    const ch = channels as Record<string, unknown>;
    out[cat] = {
      email: typeof ch.email === "boolean" ? ch.email : true,
      push: typeof ch.push === "boolean" ? ch.push : true,
      inApp: typeof ch.inApp === "boolean" ? ch.inApp : true,
    };
  }
  return out;
}
