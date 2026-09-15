"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState } from "@/components/shared/page-kit";
import { Button, Input, Label } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { SectionCard, StatusBadge } from "./shared";
import { Save, Key, Eye, EyeOff } from "lucide-react";

type ConfigResponse = {
  config: Record<string, unknown>;
  env: {
    categories: Array<{
      name: string;
      vars: Array<{
        key: string;
        label: string;
        configured: boolean;
        hint?: string;
        public?: boolean;
        value?: string;
      }>;
      configured: number;
      total: number;
    }>;
    totalConfigured: number;
    totalVars: number;
    missingCritical: string[];
  };
};

export function ConfigPanel() {
  const { data, isPending } = useQuery({
    queryKey: ["/api/admin/system/configuration"],
    queryFn: () => apiFetch<ConfigResponse>("/api/admin/system/configuration"),
    staleTime: 30 * 1000,
  });

  if (isPending) return <LoadingState label="Loading configuration…" />;
  if (!data) return <p className="text-destructive">Failed to load config.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration Center"
        description="Environment variables + system configuration. Secrets are NEVER shown — only Configured / Not Configured status."
        breadcrumbs={["Admin", "System Administration", "Configuration"]}
      />

      {data.env.missingCritical.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Missing critical environment variables:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-destructive/80">
            {data.env.missingCritical.map((k) => (
              <li key={k} className="font-mono">{k}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            These variables are required for the application to function correctly.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Configured</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {data.env.totalConfigured} / {data.env.totalVars}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Categories</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{data.env.categories.length}</p>
        </div>
      </div>

      {/* Env vars by category */}
      {data.env.categories.map((cat) => (
        <SectionCard
          key={cat.name}
          title={cat.name}
          description={`${cat.configured} of ${cat.total} variables configured`}
        >
          <div className="space-y-2">
            {cat.vars.map((v) => (
              <EnvVarRow key={v.key} varDef={v} />
            ))}
          </div>
        </SectionCard>
      ))}

      {/* System configuration editor (non-secret keys) */}
      <SystemConfigForm initial={data.config} />
    </div>
  );
}

function EnvVarRow({
  varDef,
}: {
  varDef: { key: string; label: string; configured: boolean; hint?: string; public?: boolean; value?: string };
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/50 p-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs font-medium">{varDef.key}</code>
          <StatusBadge status={varDef.configured ? "healthy" : "not_configured"} label={varDef.configured ? "Configured" : "Missing"} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{varDef.label}</p>
        {varDef.hint && <p className="text-xs text-muted-foreground">{varDef.hint}</p>}
        {varDef.public && varDef.value && (
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              {revealed ? varDef.value : "•".repeat(Math.min(varDef.value.length, 24))}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </div>
        )}
        {!varDef.public && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">Secret — value hidden</p>
        )}
      </div>
    </div>
  );
}

function SystemConfigForm({ initial }: { initial: Record<string, unknown> }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initial).map(([k, v]) => [
        k,
        typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
      ]),
    ),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== String(initial[k] ?? "")) {
          // Try parsing JSON for non-string defaults
          const original = initial[k];
          if (typeof original === "number") updates[k] = Number(v);
          else if (typeof original === "boolean") updates[k] = v === "true";
          else if (Array.isArray(original)) {
            try {
              updates[k] = JSON.parse(v);
            } catch {
              updates[k] = v.split(",").map((s) => s.trim());
            }
          } else updates[k] = v;
        }
      }
      if (Object.keys(updates).length === 0) throw new Error("No changes");
      return apiFetch<{ count: number }>("/api/admin/system/configuration", { method: "PUT", json: { updates } });
    },
    onSuccess: (data: { count: number }) => {
      toast({ title: `Saved ${data.count} config key(s)`, variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/configuration"] });
    },
    onError: (err) => toast({ title: "Save failed", description: (err as Error).message, variant: "error" }),
  });

  const editableKeys = Object.keys(initial).filter((k) => !/secret|password|token|api[_-]?key/i.test(k));

  return (
    <SectionCard
      title="System Configuration"
      description="Non-secret configuration values stored in the database. Keys matching /secret|password|token|apiKey/i are NEVER editable from this UI — use environment variables."
      actions={
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        {editableKeys.map((k) => (
          <div key={k} className="space-y-1">
            <Label className="font-mono text-xs">{k}</Label>
            <Input
              value={form[k] ?? ""}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="font-mono text-xs"
            />
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Key className="h-3 w-3" />
        Secret keys (backup access/secret, SMTP password, AUTH_SECRET) must be set as environment variables — never via this UI.
      </p>
    </SectionCard>
  );
}
