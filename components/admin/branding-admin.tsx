"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-kit";
import { Button, Input, Label } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  Upload,
  Trash2,
  RotateCcw,
  Save,
  Loader2,
  Check,
} from "lucide-react";

type Setting = {
  key: string;
  label: string;
  type: "text" | "image" | "url" | "color";
  value: string | null;
  default: string;
  description?: string;
};

type SettingsResponse = { settings: Setting[] };

export function BrandingAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/admin/site-settings"],
    queryFn: () => apiFetch<SettingsResponse>("/api/admin/site-settings"),
  });

  const settings = data?.settings ?? [];

  async function saveSetting(key: string, value: string | null) {
    setSaving(true);
    try {
      await apiFetch("/api/admin/site-settings", {
        method: "PUT",
        json: { key, value },
      });
      toast({ title: "Saved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/site-settings"] });
      qc.invalidateQueries({ queryKey: ["/api/brand"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function resetSetting(key: string) {
    if (!confirm("Reset this setting to the default value?")) return;
    try {
      await apiFetch(`/api/admin/site-settings?key=${key}`, { method: "DELETE" });
      toast({ title: "Reset to default", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/site-settings"] });
      qc.invalidateQueries({ queryKey: ["/api/brand"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    }
  }

  async function uploadLogo(key: string, file: File) {
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "brand");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message ?? "Upload failed");
      }
      const fileUrl = body.data.url as string;

      await apiFetch("/api/admin/site-settings", {
        method: "PUT",
        json: { key, value: fileUrl },
      });
      toast({ title: "Logo uploaded", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/site-settings"] });
      qc.invalidateQueries({ queryKey: ["/api/brand"] });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "error" });
    } finally {
      setUploadingKey(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Branding & Logo" description="Manage your logo, brand name, and colors." />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const imageSettings = settings.filter((s) => s.type === "image");
  const textSettings = settings.filter((s) => s.type === "text");
  const colorSettings = settings.filter((s) => s.type === "color");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branding & Logo"
        description="Manage your logo, brand name, and colors. Changes appear instantly across the marketing site, admin panel, and student portal."
      />

      {/* Logo Management Section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Logo Management</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your logo in different variants. PNG with transparent background is recommended.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {imageSettings.map((setting) => (
            <LogoCard
              key={setting.key}
              setting={setting}
              onUpload={(file) => uploadLogo(setting.key, file)}
              onReset={() => resetSetting(setting.key)}
              uploading={uploadingKey === setting.key}
              saving={saving}
            />
          ))}
        </div>
      </div>

      {/* Brand Name + Tagline */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Brand Identity</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {textSettings.map((setting) => (
            <TextField
              key={setting.key}
              setting={setting}
              onSave={(value) => saveSetting(setting.key, value)}
              saving={saving}
            />
          ))}
        </div>
      </div>

      {/* Colors */}
      {colorSettings.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Brand Colors</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {colorSettings.map((setting) => (
              <ColorField
                key={setting.key}
                setting={setting}
                onSave={(value) => saveSetting(setting.key, value)}
                saving={saving}
              />
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Live Preview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is how your logo appears in the navbar.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-white p-6 dark:bg-slate-900">
          {imageSettings[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSettings[0].value ?? imageSettings[0].default}
              alt="Logo preview"
              className="h-10 w-auto object-contain"
            />
          )}
        </div>
        <div className="mt-3 rounded-lg border border-border bg-slate-900 p-6">
          {imageSettings[1] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSettings[1].value ?? imageSettings[1].default}
              alt="Logo light preview"
              className="h-10 w-auto object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Logo Card ─────────────────────────────────────────────────────

function LogoCard({
  setting,
  onUpload,
  onReset,
  uploading,
  saving,
}: {
  setting: Setting;
  onUpload: (file: File) => void;
  onReset: () => void;
  uploading: boolean;
  saving: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUrl = setting.value ?? setting.default;
  const isCustom = setting.value !== null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{setting.label}</h3>
        {isCustom && (
          <button
            onClick={onReset}
            disabled={saving}
            className="text-xs text-muted-foreground hover:text-foreground"
            title="Reset to default"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Preview */}
      <div className="mt-3 grid h-28 place-items-center rounded-lg border border-border bg-white dark:bg-slate-900">
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={setting.label}
            className="max-h-20 max-w-full object-contain"
          />
        )}
      </div>

      {setting.description && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {setting.description}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload
        </Button>
        {isCustom && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (confirm("Remove this logo and revert to default?")) {
                onReset();
              }
            }}
            disabled={saving}
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isCustom && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
          <Check className="h-3 w-3" /> Custom logo
        </p>
      )}
    </div>
  );
}

// ── Text Field ────────────────────────────────────────────────────

function TextField({
  setting,
  onSave,
  saving,
}: {
  setting: Setting;
  onSave: (value: string) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(setting.value ?? setting.default);
  const isDirty = value !== (setting.value ?? setting.default);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={setting.key}>{setting.label}</Label>
      <Input
        id={setting.key}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={setting.default}
      />
      {setting.description && (
        <p className="text-[11px] text-muted-foreground">{setting.description}</p>
      )}
      {isDirty && (
        <Button size="sm" onClick={() => onSave(value)} disabled={saving} className="mt-1">
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      )}
    </div>
  );
}

// ── Color Field ───────────────────────────────────────────────────

function ColorField({
  setting,
  onSave,
  saving,
}: {
  setting: Setting;
  onSave: (value: string) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(setting.value ?? setting.default);
  const isDirty = value !== (setting.value ?? setting.default);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={setting.key}>{setting.label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-card"
        />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 font-mono text-sm"
        />
      </div>
      {setting.description && (
        <p className="text-[11px] text-muted-foreground">{setting.description}</p>
      )}
      {isDirty && (
        <Button size="sm" onClick={() => onSave(value)} disabled={saving} className="mt-1">
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      )}
    </div>
  );
}
