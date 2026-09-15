"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState } from "@/components/shared/page-kit";
import { Button, Input, Label } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { SectionCard, StatusBadge } from "./shared";
import { Save, BarChart3, MousePointerClick, Cookie, ShieldCheck } from "lucide-react";

type AnalyticsResponse = {
  config: {
    ga4: { enabled: boolean; measurementId: string };
    gtm: { enabled: boolean; containerId: string };
    meta: { enabled: boolean; pixelId: string };
    vercelAnalytics: { enabled: boolean };
    vercelSpeedInsights: { enabled: boolean };
  };
  env: {
    ga4MeasurementId: boolean;
    gtmContainerId: boolean;
    metaPixelId: boolean;
  };
  validation: Array<{ field: string; valid: boolean; message?: string }>;
};

export function AnalyticsManager() {
  const { data, isPending } = useQuery({
    queryKey: ["/api/admin/system/analytics"],
    queryFn: () => apiFetch<AnalyticsResponse>("/api/admin/system/analytics"),
    staleTime: 30 * 1000,
  });

  if (isPending) return <LoadingState label="Loading analytics config…" />;
  if (!data) return <p className="text-destructive">Failed to load analytics config.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Marketing Pixels"
        description="Configure GA4, GTM, Meta Pixel. Tracking is consent-gated."
        breadcrumbs={["Admin", "System Administration", "Analytics"]}
      />

      <ConsentOverview />

      <AnalyticsConfigForm initial={data.config} env={data.env} validation={data.validation} />

      <TestEventPanel />

      <SectionCard
        title="Sensitive Data Filtering"
        description="trackEvent() automatically strips these fields before sending to any provider."
        actions={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          {[
            "email", "phone", "passport", "nationalId", "password", "passwordHash",
            "documentId", "applicationId", "paymentId", "invoiceId", "studentId", "userId",
            "name", "address", "dob", "token", "secret",
          ].map((f) => (
            <code key={f} className="rounded bg-muted px-1.5 py-1 text-center font-mono text-[10px]">
              {f}
            </code>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Any value matching passport / national-ID / email / 8+ digit patterns is also dropped.
        </p>
      </SectionCard>
    </div>
  );
}

function ConsentOverview() {
  return (
    <SectionCard
      title="Consent Management"
      description="User consent is required before any analytics or marketing scripts load."
      actions={<Cookie className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <ConsentCard
          level="Necessary"
          description="Required for the app to function (auth, security). Always on."
          enabled
          alwaysOn
        />
        <ConsentCard
          level="Analytics"
          description="GA4, GTM. Aggregated, anonymous traffic data."
          enabled={false}
        />
        <ConsentCard
          level="Marketing"
          description="Meta Pixel. Used for retargeting and conversion tracking."
          enabled={false}
        />
      </div>
    </SectionCard>
  );
}

function ConsentCard({
  level,
  description,
  enabled,
  alwaysOn,
}: {
  level: string;
  description: string;
  enabled: boolean;
  alwaysOn?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="flex items-center justify-between">
        <p className="font-medium">{level}</p>
        <StatusBadge
          status={alwaysOn || enabled ? "healthy" : "not_configured"}
          label={alwaysOn ? "Always On" : enabled ? "Granted" : "Pending"}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function AnalyticsConfigForm({
  initial,
  env,
  validation,
}: {
  initial: AnalyticsResponse["config"];
  env: AnalyticsResponse["env"];
  validation: AnalyticsResponse["validation"];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);

  const mutation = useMutation({
    mutationFn: async () => apiFetch("/api/admin/system/analytics", { method: "PUT", json: form }),
    onSuccess: () => {
      toast({ title: "Analytics config saved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/analytics"] });
    },
    onError: (err) => toast({ title: "Save failed", description: (err as Error).message, variant: "error" }),
  });

  return (
    <SectionCard
      title="Provider Configuration"
      description="Public IDs only — never paste API secrets here. Use env vars for any secret credentials."
      actions={
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className="h-4 w-4" /> Save
        </Button>
      }
    >
      <div className="space-y-6">
        {/* GA4 */}
        <div className="rounded-md border border-border p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Google Analytics 4</h3>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.ga4.enabled}
                onChange={(e) => setForm({ ...form, ga4: { ...form.ga4, enabled: e.target.checked } })}
                className="h-4 w-4"
              />
              Enabled
            </label>
          </div>
          <Label>Measurement ID (G-XXXXXXXX)</Label>
          <Input
            value={form.ga4.measurementId}
            onChange={(e) => setForm({ ...form, ga4: { ...form.ga4, measurementId: e.target.value } })}
            placeholder="G-XXXXXXXXXX"
            className="mt-1 font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            env NEXT_PUBLIC_GA4_MEASUREMENT_ID: {env.ga4MeasurementId ? "Configured" : "Not set"}
          </p>
        </div>

        {/* GTM */}
        <div className="rounded-md border border-border p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Google Tag Manager</h3>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.gtm.enabled}
                onChange={(e) => setForm({ ...form, gtm: { ...form.gtm, enabled: e.target.checked } })}
                className="h-4 w-4"
              />
              Enabled
            </label>
          </div>
          <Label>Container ID (GTM-XXXXXXX)</Label>
          <Input
            value={form.gtm.containerId}
            onChange={(e) => setForm({ ...form, gtm: { ...form.gtm, containerId: e.target.value } })}
            placeholder="GTM-XXXXXXX"
            className="mt-1 font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            env NEXT_PUBLIC_GTM_CONTAINER_ID: {env.gtmContainerId ? "Configured" : "Not set"}
          </p>
        </div>

        {/* Meta Pixel */}
        <div className="rounded-md border border-border p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Meta Pixel (Facebook)</h3>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.meta.enabled}
                onChange={(e) => setForm({ ...form, meta: { ...form.meta, enabled: e.target.checked } })}
                className="h-4 w-4"
              />
              Enabled
            </label>
          </div>
          <Label>Pixel ID (15-16 digit number)</Label>
          <Input
            value={form.meta.pixelId}
            onChange={(e) => setForm({ ...form, meta: { ...form.meta, pixelId: e.target.value } })}
            placeholder="1234567890123456"
            className="mt-1 font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            env NEXT_PUBLIC_META_PIXEL_ID: {env.metaPixelId ? "Configured" : "Not set"}
          </p>
        </div>

        {/* Vercel */}
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Vercel Analytics</h3>
              <p className="text-xs text-muted-foreground">Privacy-friendly, first-party analytics built into Vercel.</p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.vercelAnalytics.enabled}
                onChange={(e) => setForm({ ...form, vercelAnalytics: { enabled: e.target.checked } })}
                className="h-4 w-4"
              />
              Enabled
            </label>
          </div>
        </div>

        {/* Validation */}
        {validation.length > 0 && (
          <div className="rounded-md border border-info/30 bg-info/5 p-3 text-xs">
            <p className="font-medium">Validation results:</p>
            <ul className="mt-1 space-y-0.5">
              {validation.map((v) => (
                <li key={v.field}>
                  <StatusBadge status={v.valid ? "PASS" : "FAIL"} /> <code>{v.field}</code>{" "}
                  {v.message && <span className="text-muted-foreground">— {v.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function TestEventPanel() {
  const { toast } = useToast();
  const [eventName, setEventName] = useState("test_event");
  const [provider, setProvider] = useState<"ga4" | "gtm" | "meta" | "all">("all");

  const mutation = useMutation({
    mutationFn: async () =>
      apiFetch<{ dispatched: string[]; blocked: string[] }>("/api/admin/system/tracking/test", {
        method: "POST",
        json: { provider, eventName },
      }),
    onSuccess: (data: { dispatched: string[]; blocked: string[] }) => {
      toast({
        title: "Test event dispatched",
        description: `Sent to: ${data.dispatched.join(", ") || "none"} • Blocked: ${data.blocked.join(", ") || "none"}`,
        variant: "success",
      });
    },
    onError: (err) => toast({ title: "Test failed", description: (err as Error).message, variant: "error" }),
  });

  return (
    <SectionCard
      title="Test Event Dispatcher"
      description="Records a test event in the system log. Actual provider dispatch happens client-side (server can't call window.gtag)."
      actions={<MousePointerClick className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Event name</Label>
          <Input value={eventName} onChange={(e) => setEventName(e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label>Provider</Label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "ga4" | "gtm" | "meta" | "all")}
            className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
          >
            <option value="all">All providers</option>
            <option value="ga4">GA4 only</option>
            <option value="gtm">GTM only</option>
            <option value="meta">Meta Pixel only</option>
          </select>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !eventName}>
          {mutation.isPending ? "Sending…" : "Send test event"}
        </Button>
      </div>
      <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
        <p className="font-medium">Debug tip:</p>
        <p>
          To verify the event was actually received by a provider, open your browser dev tools → Network tab,
          then trigger the event from the client UI (e.g. submit the contact form). Server-side dispatch isn&apos;t possible
          because providers are JS-only.
        </p>
      </div>
    </SectionCard>
  );
}

void BarChart3;
