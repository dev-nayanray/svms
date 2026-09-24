import { redirect } from "next/navigation";
import { Bell, Palette, Globe, Lock, Shield, HelpCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent } from "@/components/ui";
import { getSettings } from "@/lib/services/settings-cases";
import { SettingsClient } from "@/components/employee/settings/settings-client";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, isTranslationComplete } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "language", label: "Language", icon: Globe },
  { value: "privacy", label: "Privacy", icon: Lock },
  { value: "security", label: "Security", icon: Shield },
  { value: "help", label: "Help", icon: HelpCircle },
] as const;

export default async function EmployeeSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/settings");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");

  let settings;
  try {
    settings = await getSettings(session.user.id);
  } catch (err) {
    console.error("[employee/settings]", err);
    return (
      <div>
        <EmployeePageHeader title="Settings" description="Could not load — server error." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">An unexpected error occurred.</CardContent></Card>
      </div>
    );
  }

  const sp = await searchParams;
  const activeTab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : "notifications";

  // Pre-build the language metadata for the UI (which languages are
  // fully translated, which are stubs).
  const languages = SUPPORTED_LANGUAGES.map((code) => ({
    code,
    label: LANGUAGE_LABELS[code].label,
    nativeName: LANGUAGE_LABELS[code].nativeName,
    complete: isTranslationComplete(code),
  }));

  return (
    <div>
      <EmployeePageHeader
        title="Settings"
        description="Workspace preferences, notifications, and account security."
      />

      <SettingsClient
        initialSettings={settings}
        initialTab={activeTab}
        tabs={TABS.map((t) => ({ value: t.value, label: t.label }))}
        languages={languages}
      />
    </div>
  );
}
