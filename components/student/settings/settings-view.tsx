"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  Globe,
  HelpCircle,
  Languages,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  Shield,
  Sun,
  User,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Input } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────

type Preferences = {
  id: string;
  notifApplication: boolean;
  notifDocuments: boolean;
  notifVisa: boolean;
  notifPayments: boolean;
  notifTasks: boolean;
  notifMessages: boolean;
  notifAppointments: boolean;
  theme: string;
  language: string;
  updatedAt: string;
};

type Account = {
  email: string;
  phone: string | null;
  whatsapp: string | null;
  alternativePhone: string | null;
  firstName: string;
  lastName: string;
};

type SettingsResponse = { preferences: Preferences; account: Account };

// ── Component ──────────────────────────────────────────────────────

export function SettingsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const settingsQ = useQuery<SettingsResponse>({
    queryKey: ["student-settings"],
    queryFn: () => apiFetch<SettingsResponse>("/api/student/settings"),
    retry: false,
    staleTime: 30_000,
  });

  if (settingsQ.isLoading && !settingsQ.data) {
    return (
      <MobilePage>
        <SettingsSkeleton />
      </MobilePage>
    );
  }

  if (settingsQ.isError && !settingsQ.data) {
    return (
      <MobilePage>
        <MobileCard className="py-8 text-center">
          {!online ? (
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          )}
          <h2 className="mt-3 text-base font-semibold">
            {!online ? "You're offline" : "Couldn't load settings"}
          </h2>
          <Button onClick={() => settingsQ.refetch()} className="mt-4" disabled={!online}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  const { preferences, account } = settingsQ.data!;

  async function updatePreferences(patch: Partial<Preferences>) {
    // Optimistic
    qc.setQueryData<SettingsResponse>(["student-settings"], (prev) =>
      prev ? { ...prev, preferences: { ...prev.preferences, ...patch } } : prev,
    );
    try {
      const result = await apiFetch<{ preferences: Preferences }>("/api/student/settings", {
        method: "PATCH",
        json: patch,
      });
      qc.setQueryData<SettingsResponse>(["student-settings"], (prev) =>
        prev ? { ...prev, preferences: result.preferences } : prev,
      );

      // Apply theme change immediately
      if (patch.theme) {
        applyTheme(patch.theme);
      }

      toast({ title: "Settings saved", variant: "success" });
    } catch (err) {
      qc.invalidateQueries({ queryKey: ["student-settings"] });
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    }
  }

  function applyTheme(theme: string) {
    const root = document.documentElement;
    try {
      localStorage.setItem("svms-theme", theme);
    } catch { /* ignore */ }
    if (theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  return (
    <MobilePage>
      {/* Profile summary */}
      <MobileCard className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {account.firstName.charAt(0)}{account.lastName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{account.firstName} {account.lastName}</p>
          <p className="truncate text-xs text-muted-foreground">{account.email}</p>
        </div>
        <Link href="/student/profile" className="shrink-0">
          <Button size="sm" variant="ghost">Edit Profile</Button>
        </Link>
      </MobileCard>

      {/* Account section */}
      <SettingsSection icon={<User className="h-4 w-4 text-primary" />} title="Account">
        <dl className="space-y-2 text-sm">
          <Row label="Email" value={account.email} />
          <Row label="Phone" value={account.phone || "—"} />
          <Row label="WhatsApp" value={account.whatsapp || "—"} />
          <Row label="Alt Phone" value={account.alternativePhone || "—"} />
        </dl>
        <Link href="/student/profile" className="mt-3 block">
          <Button size="sm" variant="outline" className="w-full">
            Edit Account Details
          </Button>
        </Link>
      </SettingsSection>

      {/* Notifications section */}
      <SettingsSection icon={<Bell className="h-4 w-4 text-primary" />} title="Notifications" defaultOpen>
        <p className="mb-3 text-xs text-muted-foreground">
          Choose which notifications you want to receive. These control push notifications — you&apos;ll still see all updates in the notification center.
        </p>
        <div className="space-y-2">
          <ToggleRow
            label="Application Updates"
            checked={preferences.notifApplication}
            onChange={(v) => updatePreferences({ notifApplication: v })}
          />
          <ToggleRow
            label="Document Updates"
            checked={preferences.notifDocuments}
            onChange={(v) => updatePreferences({ notifDocuments: v })}
          />
          <ToggleRow
            label="Visa Updates"
            checked={preferences.notifVisa}
            onChange={(v) => updatePreferences({ notifVisa: v })}
          />
          <ToggleRow
            label="Payment Updates"
            checked={preferences.notifPayments}
            onChange={(v) => updatePreferences({ notifPayments: v })}
          />
          <ToggleRow
            label="Task Reminders"
            checked={preferences.notifTasks}
            onChange={(v) => updatePreferences({ notifTasks: v })}
          />
          <ToggleRow
            label="Messages"
            checked={preferences.notifMessages}
            onChange={(v) => updatePreferences({ notifMessages: v })}
          />
          <ToggleRow
            label="Appointment Reminders"
            checked={preferences.notifAppointments}
            onChange={(v) => updatePreferences({ notifAppointments: v })}
          />
        </div>
      </SettingsSection>

      {/* Security section */}
      <SettingsSection icon={<Shield className="h-4 w-4 text-primary" />} title="Security">
        <PasswordForm onSaved={() => toast({ title: "Password changed", variant: "success" })} />
        <div className="mt-3 rounded-md border border-border p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Active Sessions</p>
          <p className="mt-1">Session management will be available in a future update. For now, use Logout to end your session on this device.</p>
        </div>
      </SettingsSection>

      {/* Appearance section */}
      <SettingsSection icon={<Palette className="h-4 w-4 text-primary" />} title="Appearance" defaultOpen>
        <p className="mb-3 text-xs text-muted-foreground">Choose how the app looks.</p>
        <div className="grid grid-cols-3 gap-2">
          <ThemeOption
            icon={<Sun className="h-4 w-4" />}
            label="Light"
            active={preferences.theme === "light"}
            onClick={() => updatePreferences({ theme: "light" })}
          />
          <ThemeOption
            icon={<Moon className="h-4 w-4" />}
            label="Dark"
            active={preferences.theme === "dark"}
            onClick={() => updatePreferences({ theme: "dark" })}
          />
          <ThemeOption
            icon={<Palette className="h-4 w-4" />}
            label="System"
            active={preferences.theme === "system"}
            onClick={() => updatePreferences({ theme: "system" })}
          />
        </div>
      </SettingsSection>

      {/* Language section */}
      <SettingsSection icon={<Languages className="h-4 w-4 text-primary" />} title="Language">
        <p className="mb-3 text-xs text-muted-foreground">
          Select your preferred language. Full translations coming soon.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ThemeOption
            icon={<Globe className="h-4 w-4" />}
            label="English"
            active={preferences.language === "en"}
            onClick={() => updatePreferences({ language: "en" })}
          />
          <ThemeOption
            icon={<Globe className="h-4 w-4" />}
            label="বাংলা"
            active={preferences.language === "bn"}
            onClick={() => updatePreferences({ language: "bn" })}
          />
        </div>
      </SettingsSection>

      {/* Help section */}
      <SettingsSection icon={<HelpCircle className="h-4 w-4 text-primary" />} title="Help & Support">
        <div className="space-y-2">
          <Link href="/student/support" className="block">
            <Button size="sm" variant="outline" className="w-full justify-start">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden /> FAQ & Support Center
            </Button>
          </Link>
          <Link href="/student/messages" className="block">
            <Button size="sm" variant="outline" className="w-full justify-start">
              Contact Your Counselor
            </Button>
          </Link>
        </div>
      </SettingsSection>

      {/* Logout section */}
      <MobileCard className="space-y-2">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log Out
        </button>
      </MobileCard>

      {/* Logout confirmation dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={() => setShowLogoutConfirm(false)}>
          <div className="w-full max-w-sm rounded-t-2xl border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:rounded-xl md:border" onClick={(e) => e.stopPropagation()}>
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted md:hidden" />
            <h3 className="text-base font-semibold">Log Out?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ll need to sign in again to access your student portal.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  signOut({ callbackUrl: "/login" });
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden /> Log Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* App version */}
      <p className="text-center text-[11px] text-muted-foreground">
        SVMS Student Portal · v0.1.0
      </p>

      {/* Refresh + offline */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{settingsQ.isFetching ? "Refreshing…" : "Settings loaded"}</span>
        {!online && (
          <span className="flex items-center gap-1 text-warning">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => settingsQ.refetch()} disabled={settingsQ.isFetching} aria-label="Refresh list">
          <RefreshCw className={cn("h-3.5 w-3.5", settingsQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function SettingsSection({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <MobileCard className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-3 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold">{title}</h2>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </MobileCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

function ThemeOption({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PasswordForm({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = current.length >= 1 && next.length >= 8 && next === confirm && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/student/settings/password", {
        method: "POST",
        json: { currentPassword: current, newPassword: next },
      });
      setCurrent(""); setNext(""); setConfirm("");
      onSaved();
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Current Password</label>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={submitting} aria-label="Current password" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">New Password</label>
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} disabled={submitting} aria-label="New password" placeholder="Min 8 chars, letter + number" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={submitting} aria-label="Confirm new password" />
      </div>
      {next && confirm && next !== confirm && (
        <p className="text-xs text-destructive">Passwords don&apos;t match</p>
      )}
      <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="w-full">
        {submitting ? "Changing…" : "Change Password"}
      </Button>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-16 w-full rounded-xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
