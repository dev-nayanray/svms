"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check, AlertCircle, LogOut, ExternalLink, Sun, Moon, Monitor } from "lucide-react";
import { Button, Input, Label, Badge, Card, CardContent, CardHeader, CardTitle, Separator } from "@/components/ui";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { applyTheme } from "@/components/employee/app-shell";
import {
  THEMES,
  type UserSettings,
  type Theme,
  type NotificationPrefs,
  type PrivacyPrefs,
} from "@/lib/services/settings-cases";
import {
  NOTIFICATION_CATEGORIES,
  CATEGORY_META,
  type NotificationCategory,
} from "@/lib/services/notification-cases";
import type { Language } from "@/lib/i18n";

type Tab = { value: string; label: string };
type LanguageMeta = { code: Language; label: string; nativeName: string; complete: boolean };

type Props = {
  initialSettings: UserSettings;
  initialTab: string;
  tabs: Tab[];
  languages: LanguageMeta[];
};

export function SettingsClient({ initialSettings, initialTab, tabs, languages }: Props) {
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Sidebar tab list */}
      <nav aria-label="Settings sections" className="flex flex-row flex-wrap gap-1 lg:flex-col">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setActiveTab(t.value)}
            aria-current={activeTab === t.value ? "page" : undefined}
            className={cn(
              "inline-flex h-9 min-w-[120px] items-center rounded-md border px-3 text-sm font-medium transition-colors",
              activeTab === t.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div>
        {activeTab === "notifications" && (
          <NotificationsTab settings={settings} onChange={setSettings} />
        )}
        {activeTab === "appearance" && (
          <AppearanceTab settings={settings} onChange={setSettings} />
        )}
        {activeTab === "language" && (
          <LanguageTab settings={settings} onChange={setSettings} languages={languages} />
        )}
        {activeTab === "privacy" && (
          <PrivacyTab settings={settings} onChange={setSettings} />
        )}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "help" && <HelpTab />}
      </div>
    </div>
  );
}

// ── Notifications ───────────────────────────────────────────────────

function NotificationsTab({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (s: UserSettings) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleChannel(cat: NotificationCategory, channel: "email" | "push" | "inApp") {
    const current = settings.notificationPrefs[cat];
    const updated: NotificationPrefs = {
      ...settings.notificationPrefs,
      [cat]: { ...current, [channel]: !current[channel] },
    };
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cat]: updated[cat] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      onChange(data.data as UserSettings);
      toast({ title: "Notification preferences saved", variant: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast({ title: "Could not save preferences", description: msg, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
        <p className="text-xs text-muted-foreground">
          Choose which notifications you receive for each category, and on which channels.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {saving && (
          <div className="border-b border-border bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
            <Loader2 className="inline h-3 w-3 animate-spin" /> Saving…
          </div>
        )}
        {error && (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
            <AlertCircle className="inline h-3 w-3" /> {error}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Push</th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">In-app</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {NOTIFICATION_CATEGORIES.map((cat) => {
              const prefs = settings.notificationPrefs[cat];
              const meta = CATEGORY_META[cat];
              return (
                <tr key={cat}>
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-medium">{meta.label}</p>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Toggle checked={prefs.email} onChange={() => toggleChannel(cat, "email")} disabled={saving} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Toggle checked={prefs.push} onChange={() => toggleChannel(cat, "push")} disabled={saving} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Toggle checked={prefs.inApp} onChange={() => toggleChannel(cat, "inApp")} disabled={saving} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// ── Appearance ──────────────────────────────────────────────────────

function AppearanceTab({ settings, onChange }: { settings: UserSettings; onChange: (s: UserSettings) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<Theme | null>(null);

  async function changeTheme(theme: Theme) {
    setSaving(theme);
    try {
      const res = await fetch("/api/employee/settings/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      onChange(data.data as UserSettings);
      // Apply theme to document for immediate visual feedback
      applyTheme(theme);
      toast({ title: "Theme updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not change theme",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">Theme</p>
          <p className="text-xs text-muted-foreground">
            Choose how Euroscope looks to you. "System" follows your OS preference.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => changeTheme(theme)}
              disabled={saving !== null}
              className={cn(
                "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                settings.theme === theme
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/30",
              )}
            >
              <span className="grid h-9 w-9 place-items-center rounded-md bg-muted">
                {theme === "system" ? <Monitor className="h-4 w-4" /> : theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{titleCase(theme)}</p>
                {settings.theme === theme && (
                  <p className="text-[10px] text-primary">Active</p>
                )}
              </div>
              {saving === theme && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Language ────────────────────────────────────────────────────────

function LanguageTab({
  settings,
  onChange,
  languages,
}: {
  settings: UserSettings;
  onChange: (s: UserSettings) => void;
  languages: LanguageMeta[];
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<Language | null>(null);

  async function changeLanguage(lang: Language) {
    setSaving(lang);
    try {
      const res = await fetch("/api/employee/settings/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      onChange(data.data as UserSettings);
      toast({ title: "Language updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not change language",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Language</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">Display language</p>
          <p className="text-xs text-muted-foreground">
            Choose your preferred language for the Euroscope interface.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => changeLanguage(lang.code)}
              disabled={saving !== null}
              className={cn(
                "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                settings.language === lang.code
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/30",
              )}
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{lang.nativeName}</p>
                <p className="text-xs text-muted-foreground">{lang.label} · {lang.code.toUpperCase()}</p>
              </div>
              {settings.language === lang.code && (
                <Badge tone="info" className="text-[10px]">Active</Badge>
              )}
              {!lang.complete && lang.code !== "en" && (
                <Badge tone="warning" className="text-[10px]">In progress</Badge>
              )}
              {saving === lang.code && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </button>
          ))}
        </div>
        {!languages.find((l) => l.code === settings.language)?.complete && (
          <p className="text-xs text-muted-foreground">
            Note: This language is still being translated. Some text may appear in English until the
            translation is complete.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Privacy ──────────────────────────────────────────────────────────

function PrivacyTab({ settings, onChange }: { settings: UserSettings; onChange: (s: UserSettings) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<keyof PrivacyPrefs | null>(null);

  async function togglePrivacy(key: keyof PrivacyPrefs) {
    setSaving(key);
    try {
      const newValue = !settings.privacy[key];
      const res = await fetch("/api/employee/settings/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      onChange(data.data as UserSettings);
      toast({ title: "Privacy preference saved", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not save privacy preference",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Privacy</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <PrivacyRow
          label="Show profile to students"
          description="When enabled, students assigned to you can see your name, photo, and contact details."
          checked={settings.privacy.showProfileToStudents}
          onChange={() => togglePrivacy("showProfileToStudents")}
          disabled={saving !== null}
        />
        <Separator />
        <PrivacyRow
          label="Show online status"
          description="When enabled, your online presence is visible to colleagues."
          checked={settings.privacy.showOnlineStatus}
          onChange={() => togglePrivacy("showOnlineStatus")}
          disabled={saving !== null}
        />
      </CardContent>
    </Card>
  );
}

function PrivacyRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── Security ─────────────────────────────────────────────────────────

function SecurityTab() {
  return (
    <div className="space-y-6">
      <ChangePasswordCard />
      <SessionsCard />
    </div>
  );
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/employee/security/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({ title: "Password changed", description: "Use your new password next time you sign in.", variant: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast({ title: "Could not change password", description: msg, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="current-pw">Current password</Label>
            <Input
              id="current-pw" type="password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1" required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw" type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password" minLength={8}
                className="mt-1" required
              />
            </div>
            <div>
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input
                id="confirm-pw" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password" minLength={8}
                className="mt-1" required
              />
            </div>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" /> {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Password must be ≥ 8 characters. Avoid common patterns. The change is logged for security audit.
          </p>
          <Button type="submit" disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<{ id: string; device: string; lastActive: Date; current: boolean }[] | null>(null);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/employee/security/sessions", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSessions(data.data.sessions);
        setNote(data.data.note);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function revokeAll() {
    setRevoking(true);
    try {
      const res = await fetch("/api/employee/security/sessions", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast({
          title: "Sessions revoke requested",
          description: data.data.note,
          variant: "success",
        });
      } else {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
    } catch (err) {
      toast({
        title: "Could not revoke sessions",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setRevoking(false);
    }
  }

  // Load on mount
  if (loading && sessions === null) {
    void load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <p className="text-xs text-muted-foreground">
          Manage where you&apos;re signed in. Sign out of unfamiliar sessions immediately.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessions && sessions.length > 0 ? (
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{s.device}</p>
                  <p className="text-xs text-muted-foreground">Last active: {formatDate(s.lastActive)}</p>
                </div>
                {s.current && <Badge tone="info">This device</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        )}
        {note && (
          <p className="mt-4 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
            {note}
          </p>
        )}
        <Separator className="my-4" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Sign out everywhere</p>
            <p className="text-xs text-muted-foreground">
              Request to revoke all sessions. You will be signed out from this device too.
            </p>
          </div>
          <Button variant="outline" onClick={revokeAll} disabled={revoking}>
            {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            Revoke all
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Help ─────────────────────────────────────────────────────────────

function HelpTab() {
  return (
    <Card>
      <CardHeader><CardTitle>Help &amp; support</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <HelpLink
          title="Documentation"
          description="Read the employee handbook and feature guides."
          href="/employee"
        />
        <HelpLink
          title="Contact support"
          description="Email the platform team at support@euroscope.example for account issues."
          href="mailto:support@euroscope.example"
          external
        />
        <HelpLink
          title="Privacy policy"
          description="How we handle your personal data."
          href="/employee"
        />
        <Separator />
        <div>
          <p className="text-xs font-medium text-muted-foreground">About Euroscope</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Employee Panel v1.0 · Server-rendered · IDOR-protected · Audit-logged.
            Report issues to your administrator.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HelpLink({
  title,
  description,
  href,
  external,
}: {
  title: string;
  description: string;
  href: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-start justify-between gap-3 rounded-md border border-border p-3 hover:bg-muted/30"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
