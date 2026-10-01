"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState } from "@/components/shared/page-kit";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Cpu,
  Settings,
  MessageSquare,
  FlaskConical,
  Send,
  Plus,
  Trash2,
  Plug,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  Zap,
  Activity,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";

type Provider = {
  id: string;
  provider: string;
  name: string;
  baseUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
  lastTestError: string | null;
  priority: number;
  maxRequestsPerHour: number | null;
  hasApiKey: boolean;
  models: Array<{
    id: string;
    modelId: string;
    name: string;
    supportsStreaming: boolean;
    supportsToolCalling: boolean;
    supportsVision: boolean;
    contextWindow: number | null;
    enabled: boolean;
  }>;
};

type Overview = {
  activeProvider: string | null;
  activeModel: string | null;
  providerStatus: { total: number; enabled: number; connected: number; untested: number };
  usage: { totalRequests: number; totalInputTokens: number; totalOutputTokens: number; estimatedCostCents: number };
  assistantConfigs: number;
  knowledgeSources: number;
  recentErrors: Array<{ id: string; model: string; status: string; errorMessage: string | null; createdAt: string }>;
  telegramConfigured: boolean;
  telegramWebhookSecret: boolean;
  telegramConfig?: {
    configured: boolean;
    hasDbToken: boolean;
    hasEnvToken: boolean;
    hasDbSecret: boolean;
    hasEnvSecret: boolean;
    botName: string;
    welcomeMessage: string;
    enabled: boolean;
    webhookUrl: string | null;
    lastTestStatus: string | null;
    lastTestedAt: string | null;
    lastTestError: string | null;
    maskedToken: string | null;
  };
};

const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "providers", label: "AI Providers", icon: Cpu },
  { id: "playground", label: "AI Playground", icon: FlaskConical },
  { id: "telegram", label: "Telegram Bot", icon: Send },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function AiControlCenter() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, provs] = await Promise.all([
        apiFetch<Overview>("/api/admin/ai/overview"),
        apiFetch<{ providers: Provider[] }>("/api/admin/ai/providers"),
      ]);
      setOverview(ov);
      setProviders(provs.providers);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ov, provs] = await Promise.all([
          apiFetch<Overview>("/api/admin/ai/overview"),
          apiFetch<{ providers: Provider[] }>("/api/admin/ai/providers"),
        ]);
        if (!cancelled) {
          setOverview(ov);
          setProviders(provs.providers);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || !overview) {
    return <LoadingState label="Loading AI control center…" />;
  }

  return (
    <div className="space-y-0">
      <PageHeader
        title="AI & Bot Control Center"
        description="Configure AI providers, test connections, manage models, and monitor usage."
      />

      {/* Section tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                activeSection === s.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Sections */}
      {activeSection === "overview" && <OverviewSection overview={overview} />}
      {activeSection === "providers" && (
        <ProvidersSection providers={providers} onChanged={loadData} />
      )}
      {activeSection === "playground" && <PlaygroundSection providers={providers} />}
      {activeSection === "telegram" && <TelegramSection overview={overview} />}
    </div>
  );
}

// ─── Overview Section ─────────────────────────────────────────────

function OverviewSection({ overview }: { overview: Overview }) {
  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Active Provider"
          value={overview.activeProvider ?? "—"}
          icon={Cpu}
          tone={overview.activeProvider ? "success" : "warning"}
        />
        <StatCard
          label="Active Model"
          value={overview.activeModel ?? "—"}
          icon={Zap}
        />
        <StatCard
          label="Providers Connected"
          value={`${overview.providerStatus.connected} / ${overview.providerStatus.total}`}
          icon={Plug}
          tone={overview.providerStatus.connected > 0 ? "success" : "warning"}
        />
        <StatCard
          label="Est. Cost (7d)"
          value={`$${(overview.usage.estimatedCostCents / 100).toFixed(2)}`}
          icon={DollarSign}
          tone="info"
        />
      </div>

      {/* Usage stats */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Usage (Last 7 Days)</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Requests</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{overview.usage.totalRequests}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Input Tokens</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{overview.usage.totalInputTokens.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Output Tokens</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{overview.usage.totalOutputTokens.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Telegram status */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Telegram Bot</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <StatusDot active={overview.telegramConfigured} />
            <span className="text-sm">Bot Token: {overview.telegramConfigured ? "Configured" : "Missing"}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot active={overview.telegramWebhookSecret} />
            <span className="text-sm">Webhook Secret: {overview.telegramWebhookSecret ? "Configured" : "Missing"}</span>
          </div>
        </div>
      </div>

      {/* Recent errors */}
      {overview.recentErrors.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold">Recent Errors</h2>
          </div>
          <div className="space-y-2">
            {overview.recentErrors.slice(0, 5).map((err) => (
              <div key={err.id} className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm">
                <Badge tone="destructive">{err.status}</Badge>
                <span className="flex-1 truncate font-mono text-xs">{err.model}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">{err.errorMessage}</span>
                <span className="text-xs text-muted-foreground">{new Date(err.createdAt).toLocaleString("en-GB")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Providers Section ────────────────────────────────────────────

function ProvidersSection({ providers, onChanged }: { providers: Provider[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">AI Providers</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Provider
        </Button>
      </div>

      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <Cpu className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">No AI providers configured</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add OpenAI, Anthropic, Gemini, or an OpenAI-compatible provider to get started.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add your first provider
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} onChanged={onChanged} />
          ))}
        </div>
      )}

      <AddProviderDialog open={addOpen} onOpenChange={setAddOpen} onAdded={onChanged} />
    </div>
  );
}

function ProviderCard({ provider, onChanged }: { provider: Provider; onChanged: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);

  const testMutation = useMutation({
    mutationFn: async (): Promise<{ status: string; message: string }> =>
      apiFetch(`/api/admin/ai/providers/${provider.id}/test`, { method: "POST", json: {} }),
    onSuccess: (data: { status: string; message: string }) => {
      const tone = data.status === "connected" ? "success" : "error";
      toast({
        title: data.status === "connected" ? "Connection successful" : "Connection failed",
        description: data.message,
        variant: tone,
      });
      onChanged();
    },
    onError: (err) => toast({ title: "Test failed", description: (err as Error).message, variant: "error" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      apiFetch("/api/admin/ai/providers", { method: "PUT", json: { id: provider.id, enabled } }),
    onSuccess: () => {
      toast({ title: `Provider ${provider.enabled ? "disabled" : "enabled"}`, variant: "success" });
      onChanged();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiFetch(`/api/admin/ai/providers?id=${provider.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Provider deleted", variant: "success" });
      onChanged();
    },
  });

  const updateKeyMutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/admin/ai/providers", { method: "PUT", json: { id: provider.id, apiKey } }),
    onSuccess: () => {
      toast({ title: "API key updated", variant: "success" });
      setApiKey("");
      setEditing(false);
      onChanged();
    },
  });

  const statusTone = provider.lastTestStatus === "connected" ? "success"
    : provider.lastTestStatus === "untested" || !provider.lastTestStatus ? "default"
    : "destructive";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{provider.name}</h3>
            <Badge tone={provider.enabled ? "success" : "default"}>
              {provider.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground capitalize">{provider.provider}</p>
        </div>
        <div className="flex items-center gap-1">
          <Badge tone={statusTone as "success" | "default" | "destructive"}>
            {provider.lastTestStatus ?? "untested"}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Model:</span>
          <span className="font-mono">{provider.defaultModel ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span>API Key:</span>
          <span className="font-mono">
            {provider.hasApiKey ? "••••••••••••" : "Not set"}
          </span>
        </div>
        {provider.lastTestedAt && (
          <div className="flex justify-between">
            <span>Last tested:</span>
            <span>{new Date(provider.lastTestedAt).toLocaleString("en-GB")}</span>
          </div>
        )}
      </div>

      {/* API key editor */}
      {editing && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-2">
          <Label className="text-xs">Update API Key</Label>
          <div className="flex gap-2">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter new API key"
              className="h-8 text-xs font-mono"
            />
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateKeyMutation.mutate()} disabled={!apiKey || updateKeyMutation.isPending}>
              {updateKeyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Save Key
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setApiKey(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testing || testMutation.isPending}
        >
          {testMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
          Test
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>
          <Settings className="h-3 w-3" /> Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => toggleMutation.mutate(!provider.enabled)}
          disabled={toggleMutation.isPending}
        >
          {provider.enabled ? "Disable" : "Enable"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            if (confirm(`Delete provider "${provider.name}"?`)) deleteMutation.mutate();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function AddProviderDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [providerType, setProviderType] = useState<"openai" | "anthropic" | "gemini" | "openai-compatible">("openai");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("");

  const mutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/admin/ai/providers", {
        method: "POST",
        json: {
          provider: providerType,
          name: name || `${providerType} Provider`,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          defaultModel: defaultModel || undefined,
        },
      }),
    onSuccess: () => {
      toast({ title: "Provider added", variant: "success" });
      onOpenChange(false);
      setName("");
      setApiKey("");
      setBaseUrl("");
      setDefaultModel("");
      onAdded();
    },
    onError: (err) => toast({ title: "Failed", description: (err as Error).message, variant: "error" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add AI Provider" className="max-w-md">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Provider Type</Label>
            <Select value={providerType} onChange={(e) => setProviderType(e.target.value as "openai" | "anthropic" | "gemini" | "openai-compatible")}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai-compatible">OpenAI-compatible (custom URL)</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. OpenAI Production" />
          </div>
          <div className="space-y-1">
            <Label>API Key</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="font-mono" />
            <p className="text-xs text-muted-foreground">Stored encrypted. Never shown again after saving.</p>
          </div>
          {providerType === "openai-compatible" && (
            <div className="space-y-1">
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openrouter.ai/v1" />
            </div>
          )}
          <div className="space-y-1">
            <Label>Default Model (optional)</Label>
            <Input value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} placeholder="gpt-4o-mini" className="font-mono" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Provider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Playground Section ──────────────────────────────────────────

function PlaygroundSection({ providers }: { providers: Provider[] }) {
  const { toast } = useToast();
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant for Euroscope, a student visa management system.");
  const [userMessage, setUserMessage] = useState("");
  const [response, setResponse] = useState("");
  const [usage, setUsage] = useState<{ inputTokens: number; outputTokens: number; latencyMs: number; costCents: number } | null>(null);

  const enabledProviders = providers.filter((p) => p.enabled);
  const selectedProvider = providers.find((p) => p.id === providerId);

  const runMutation = useMutation({
    mutationFn: async () => {
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userMessage },
      ];
      return apiFetch<{
        content: string;
        usage: { inputTokens: number; outputTokens: number };
        latencyMs: number;
        costCents: number;
      }>("/api/admin/ai/playground", {
        method: "POST",
        json: { providerId, model, messages, temperature: 0.7, maxTokens: 1024 },
      });
    },
    onSuccess: (data) => {
      setResponse(data.content);
      setUsage({
        inputTokens: data.usage.inputTokens,
        outputTokens: data.usage.outputTokens,
        latencyMs: data.latencyMs,
        costCents: data.costCents,
      });
    },
    onError: (err) => {
      toast({ title: "Generation failed", description: (err as Error).message, variant: "error" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
        <strong>Test Environment:</strong> The playground makes real API calls to the selected provider. Costs apply. Do not use real student data.
      </div>

      {/* Provider + model selection */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Provider</Label>
          <Select value={providerId} onChange={(e) => { setProviderId(e.target.value); setModel(""); }}>
            <option value="">Select a provider…</option>
            {enabledProviders.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Model</Label>
          <Select value={model} onChange={(e) => setModel(e.target.value)} disabled={!selectedProvider}>
            <option value="">Select a model…</option>
            {selectedProvider?.models.filter((m) => m.enabled).map((m) => (
              <option key={m.id} value={m.modelId}>{m.name} ({m.modelId})</option>
            )) ?? []}
          </Select>
        </div>
      </div>

      {/* System prompt */}
      <div className="space-y-1">
        <Label>System Prompt</Label>
        <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={3} />
      </div>

      {/* User message */}
      <div className="space-y-1">
        <Label>Your Message</Label>
        <Textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} rows={3} placeholder="Type a test message…" />
      </div>

      {/* Run button */}
      <Button
        onClick={() => runMutation.mutate()}
        disabled={runMutation.isPending || !providerId || !model || !userMessage}
      >
        {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Run Test
      </Button>

      {/* Response */}
      {response && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Response</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{response}</p>
          </div>
          {usage && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-muted-foreground">Input Tokens</p>
                <p className="font-bold tabular-nums">{usage.inputTokens}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-muted-foreground">Output Tokens</p>
                <p className="font-bold tabular-nums">{usage.outputTokens}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-muted-foreground">Latency</p>
                <p className="font-bold tabular-nums">{usage.latencyMs}ms</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-muted-foreground">Cost</p>
                <p className="font-bold tabular-nums">${(usage.costCents / 100).toFixed(4)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Telegram Bot Section ────────────────────────────────────────

function TelegramSection({ overview }: { overview: Overview }) {
  const { toast } = useToast();
  const [config, setConfig] = useState<NonNullable<Overview["telegramConfig"]> | null>(overview.telegramConfig ?? null);
  const [botToken, setBotToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(overview.telegramConfig?.webhookUrl ?? "");
  const [botName, setBotName] = useState(overview.telegramConfig?.botName ?? "Euroscope Assistant");
  const [welcomeMessage, setWelcomeMessage] = useState(overview.telegramConfig?.welcomeMessage ?? "");
  const [enabled, setEnabled] = useState(overview.telegramConfig?.enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [generatingSecret, setGeneratingSecret] = useState(false);

  // Load full config from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<NonNullable<Overview["telegramConfig"]>>("/api/admin/ai/telegram");
        if (!cancelled) {
          setConfig(data);
          setWebhookUrl(data.webhookUrl ?? "");
          setBotName(data.botName);
          setWelcomeMessage(data.welcomeMessage);
          setEnabled(data.enabled);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        botName,
        welcomeMessage,
        enabled,
        webhookUrl: webhookUrl || null,
      };
      // Only send token/secret if the admin typed a new value
      if (botToken) updates.botToken = botToken;
      if (webhookSecret) updates.webhookSecret = webhookSecret;

      const updated = await apiFetch<NonNullable<Overview["telegramConfig"]>>("/api/admin/ai/telegram", {
        method: "PUT",
        json: updates,
      });
      setConfig(updated);
      setBotToken("");
      setWebhookSecret("");
      toast({ title: "Telegram settings saved", variant: "success" });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await apiFetch<{ status: string; message: string; botUsername?: string }>("/api/admin/ai/telegram/test", {
        method: "POST",
      });
      toast({
        title: result.status === "connected" ? "Connection successful" : "Connection failed",
        description: result.message,
        variant: result.status === "connected" ? "success" : "error",
      });
    } catch (err) {
      toast({ title: "Test failed", description: (err as Error).message, variant: "error" });
    } finally {
      setTesting(false);
    }
  };

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const result = await apiFetch<{ success: boolean; message: string; webhookUrl?: string }>("/api/admin/ai/telegram/register", {
        method: "POST",
      });
      toast({
        title: result.success ? "Webhook registered" : "Registration failed",
        description: result.message,
        variant: result.success ? "success" : "error",
      });
    } catch (err) {
      toast({ title: "Registration failed", description: (err as Error).message, variant: "error" });
    } finally {
      setRegistering(false);
    }
  };

  const handleGenerateSecret = () => {
    setGeneratingSecret(true);
    // Generate a random hex string
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
    setWebhookSecret(secret);
    setGeneratingSecret(false);
    toast({ title: "Secret generated", description: "Click Save to store it.", variant: "success" });
  };

  const isConfigured = config?.configured ?? false;
  const hasToken = config?.hasDbToken ?? config?.hasEnvToken ?? false;
  const hasSecret = config?.hasDbSecret ?? config?.hasEnvSecret ?? false;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={cn(
        "flex items-center gap-3 rounded-lg border p-4",
        isConfigured ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5",
      )}>
        {isConfigured ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {isConfigured ? "Telegram bot is configured" : "Telegram bot needs setup"}
          </p>
          <p className="text-xs text-muted-foreground">
            {config?.maskedToken ? `Current token: ${config.maskedToken}` : "No token configured"}
            {config?.hasEnvToken && " (from env var)"}
            {config?.hasDbToken && " (from admin panel)"}
          </p>
        </div>
        {config?.lastTestStatus && (
          <Badge tone={config.lastTestStatus === "connected" ? "success" : "destructive"}>
            {config.lastTestStatus}
          </Badge>
        )}
      </div>

      {/* Configuration form */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Bot Configuration</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your Telegram bot token and webhook secret. These are stored securely in the database — never shown again after saving.
        </p>

        <div className="mt-4 space-y-4">
          {/* Bot Token */}
          <div className="space-y-1">
            <Label>Bot Token {hasToken && <span className="text-xs text-muted-foreground">(currently: {config?.maskedToken})</span>}</Label>
            <div className="flex gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={hasToken ? "•••••••• (enter new to replace)" : "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"}
                className="font-mono text-xs"
              />
              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your token from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@BotFather</a> on Telegram.
            </p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1">
            <Label>Webhook Secret {hasSecret && <span className="text-xs text-muted-foreground">(configured)</span>}</Label>
            <div className="flex gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={hasSecret ? "•••••••• (enter new to replace)" : "Click Generate to create a random secret"}
                className="font-mono text-xs"
              />
              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="outline" className="shrink-0" onClick={handleGenerateSecret} disabled={generatingSecret}>
                <Zap className="h-3.5 w-3.5" /> Generate
              </Button>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-1">
            <Label>Webhook URL (optional)</Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-domain.com (auto-detected from NEXT_PUBLIC_APP_URL if empty)"
            />
          </div>

          {/* Bot Name */}
          <div className="space-y-1">
            <Label>Bot Name</Label>
            <Input value={botName} onChange={(e) => setBotName(e.target.value)} />
          </div>

          {/* Welcome Message */}
          <div className="space-y-1">
            <Label>Welcome Message</Label>
            <Textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={2} maxLength={500} />
          </div>

          {/* Enable toggle */}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
            Enable Telegram bot (processes incoming messages)
          </label>
        </div>

        {/* Save button */}
        <div className="mt-4 flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !isConfigured}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
            Test Connection
          </Button>
          <Button size="sm" variant="outline" onClick={handleRegister} disabled={registering || !isConfigured}>
            {registering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Register Webhook
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <strong>Test Connection</strong> calls the Telegram API to verify the bot token is valid.<br />
          <strong>Register Webhook</strong> tells Telegram to send messages to your webhook URL.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <h3 className="text-sm font-semibold text-info">How the bot works</h3>
        <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>1. User messages your Telegram bot</li>
          <li>2. Bot greets them and asks for their name</li>
          <li>3. Bot asks for phone number (with a share-contact button)</li>
          <li>4. A lead is created in SVMS with source = &quot;Telegram&quot;</li>
          <li>5. Admin reviews + approves the lead</li>
          <li>6. Counselor is automatically assigned</li>
        </ol>
      </div>
    </div>
  );
}
// ─── Shared ──────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, tone = "default" }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone?: "default" | "success" | "warning" | "info" }) {
  const tones = {
    default: "border-border",
    success: "border-success/30 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
    info: "border-info/30 bg-info/5",
  };
  return (
    <div className={cn("rounded-lg border p-3", tones[tone])}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        active ? "bg-emerald-500" : "bg-muted-foreground/30",
      )}
    />
  );
}
