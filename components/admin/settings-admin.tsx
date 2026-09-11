"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { Skeleton } from "@/components/ui/overlays";
import { EmptyState } from "@/components/shared";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Save, Lock, ShieldCheck } from "lucide-react";
import { SECRET_MASK } from "@/lib/constants/settings";

type SettingItem = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "password";
  placeholder?: string;
  options?: { value: string; label: string }[];
  helpText?: string;
  isSecret?: boolean;
  isReadOnly?: boolean;
  value: unknown;
};

type SettingSection = {
  key: string;
  label: string;
  icon: string;
  description: string;
  settings: SettingItem[];
};

type SettingsData = {
  data: SettingSection[];
};

/**
 * Admin Settings — 11 sections of database-driven configuration.
 *
 * Security:
 *  - Secret settings (SMTP password, API keys) are masked as "••••••••"
 *    in the UI. If the admin submits the mask, the server treats it as
 *    a no-op (secret unchanged).
 *  - Read-only settings (system section) are displayed but disabled.
 *  - Every setting change is audit-logged with old→new diff (secrets
 *    are redacted as "[REDACTED]" in the audit log).
 *  - All settings require `settings.manage` (admin only).
 */
export function SettingsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState("company");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiFetch<SettingsData>("/api/settings"),
    staleTime: 30_000,
  });

  const sections = data?.data ?? [];
  const currentSection = sections.find((s) => s.key === activeSection);

  const getDisplayValue = (setting: SettingItem): string => {
    if (setting.key in drafts) return drafts[setting.key];
    if (setting.value == null) return "";
    if (typeof setting.value === "boolean") return setting.value ? "true" : "false";
    if (typeof setting.value === "number") return String(setting.value);
    return String(setting.value);
  };

  const save = async (key: string, value: string) => {
    setBusyKey(key);
    try {
      // Parse the value based on the setting type
      const setting = currentSection?.settings.find((s) => s.key === key);
      let parsedValue: unknown = value;

      if (setting?.type === "boolean") {
        parsedValue = value === "true";
      } else if (setting?.type === "number") {
        parsedValue = Number(value);
      }

      await apiFetch("/api/settings", {
        method: "PUT",
        json: { key, value: parsedValue },
      });
      toast({ title: "Setting saved", variant: "success" });
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusyKey(null);
    }
  };

  const updateDraft = (key: string, value: string) => {
    setDrafts((d) => ({ ...d, [key]: value }));
  };

  return (
    <>
      <PageHeader
        title="System Settings"
        description="Database-driven configuration. All changes are audit-logged. Secrets are masked in the UI."
        breadcrumbs={["Admin", "Settings"]}
      />

      {/* Security notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Sensitive settings are protected</p>
            <p className="mt-0.5 text-muted-foreground">
              Secrets (SMTP passwords, API keys) are masked as <code className="rounded bg-muted px-1 py-0.5">••••••••</code> in the UI and
              audit-logged as <code className="rounded bg-muted px-1 py-0.5">[REDACTED]</code>. Submitting the mask value is treated as a no-op.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        {/* Section tabs */}
        <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={
                "shrink-0 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors " +
                (activeSection === section.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70")
              }
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div>
          {isPending && (
            <Card>
              <CardContent className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </CardContent>
            </Card>
          )}

          {!isPending && currentSection && (
            <Card>
              <CardHeader>
                <CardTitle>{currentSection.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{currentSection.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentSection.settings.map((setting) => {
                  const value = getDisplayValue(setting);
                  const isDirty = setting.key in drafts;
                  const isBoolean = setting.type === "boolean";
                  const isSecret = setting.isSecret;
                  const isRO = setting.isReadOnly;

                  return (
                    <div key={setting.key} className="flex flex-wrap items-end gap-2">
                      <div className="min-w-56 flex-1 space-y-1">
                        <Label htmlFor={`set-${setting.key}`} className="flex items-center gap-1.5">
                          {setting.label}
                          {isSecret && <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />}
                          {isRO && <span className="text-xs text-muted-foreground">(read-only)</span>}
                        </Label>

                        {setting.type === "textarea" ? (
                          <Textarea
                            id={`set-${setting.key}`}
                            value={value}
                            placeholder={setting.placeholder}
                            onChange={(e) => updateDraft(setting.key, e.target.value)}
                            disabled={isRO}
                            className="min-h-[60px]"
                          />
                        ) : setting.type === "select" ? (
                          <Select
                            id={`set-${setting.key}`}
                            value={value}
                            onChange={(e) => updateDraft(setting.key, e.target.value)}
                            disabled={isRO}
                          >
                            <option value="">Select…</option>
                            {setting.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        ) : isBoolean ? (
                          <Select
                            id={`set-${setting.key}`}
                            value={value}
                            onChange={(e) => updateDraft(setting.key, e.target.value)}
                            disabled={isRO}
                          >
                            <option value="false">Disabled</option>
                            <option value="true">Enabled</option>
                          </Select>
                        ) : (
                          <Input
                            id={`set-${setting.key}`}
                            type={setting.type === "password" ? "password" : setting.type === "number" ? "number" : "text"}
                            value={value}
                            placeholder={setting.placeholder}
                            onChange={(e) => updateDraft(setting.key, e.target.value)}
                            disabled={isRO}
                          />
                        )}
                        {setting.helpText && (
                          <p className="text-xs text-muted-foreground">{setting.helpText}</p>
                        )}
                      </div>

                      {!isRO && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyKey === setting.key || !isDirty || (isSecret && value === SECRET_MASK)}
                          onClick={() => save(setting.key, value)}
                        >
                          <Save className="h-4 w-4" aria-hidden />
                          {busyKey === setting.key ? "Saving…" : "Save"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {!isPending && !currentSection && (
            <EmptyState title="No section selected" />
          )}
        </div>
      </div>
    </>
  );
}
