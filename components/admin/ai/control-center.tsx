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
  const [testing, setTesting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  const handleTestWebhook = async () => {
    if (!overview.telegramWebhookSecret) {
      toast({ title: "Webhook secret not configured", description: "Set TELEGRAM_WEBHOOK_SECRET in your environment variables first.", variant: "error" });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`/api/telegram/webhook?secret=${process.env.NEXT_PUBLIC_TELEGRAM_WEBHOOK_SECRET ?? "missing"}`, {
        method: "GET",
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Webhook is live", description: `Bot status: ${data.bot}`, variant: "success" });
      } else {
        toast({ title: "Webhook test failed", description: "Check the webhook secret matches your env var.", variant: "error" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the webhook endpoint.", variant: "error" });
    } finally {
      setTesting(false);
    }
  };

  const handleRegisterWebhook = async () => {
    if (!overview.telegramConfigured) {
      toast({ title: "Bot token not configured", description: "Set TELEGRAM_BOT_TOKEN in your environment variables first.", variant: "error" });
      return;
    }
    if (!webhookUrl) {
      toast({ title: "Webhook URL required", description: "Enter your production URL (e.g. https://your-domain.com)", variant: "error" });
      return;
    }
    toast({
      title: "Register via command line",
      description: `Run: curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=${webhookUrl}/api/telegram/webhook?secret=<SECRET>"`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className={cn("rounded-lg border p-3", overview.telegramConfigured ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Bot Token</p>
            {overview.telegramConfigured ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
          </div>
          <p className="mt-1 text-sm font-semibold">{overview.telegramConfigured ? "Configured" : "Missing"}</p>
        </div>
        <div className={cn("rounded-lg border p-3", overview.telegramWebhookSecret ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Webhook Secret</p>
            {overview.telegramWebhookSecret ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
          </div>
          <p className="mt-1 text-sm font-semibold">{overview.telegramWebhookSecret ? "Configured" : "Missing"}</p>
        </div>
        <div className={cn("rounded-lg border p-3", overview.telegramConfigured && overview.telegramWebhookSecret ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5")}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Overall Status</p>
            <StatusDot active={overview.telegramConfigured && overview.telegramWebhookSecret} />
          </div>
          <p className="mt-1 text-sm font-semibold">
            {overview.telegramConfigured && overview.telegramWebhookSecret ? "Ready" : "Setup needed"}
          </p>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Setup Instructions</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The Telegram bot token and webhook secret are configured via environment variables (not editable from the UI for security).
        </p>

        <div className="mt-4 space-y-4">
          {/* Step 1 */}
          <div className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Create a bot with @BotFather</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@BotFather</a> on Telegram,
                send <code className="rounded bg-muted px-1 py-0.5 text-[10px]">/newbot</code>, and follow the prompts to get your bot token.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Generate a webhook secret</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Run this command to generate a random secret:
              </p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-muted/50 p-2 text-[10px] font-mono">
                openssl rand -hex 32
              </pre>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Set environment variables</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add these to your <code className="rounded bg-muted px-1 py-0.5 text-[10px]">.env</code> file (local) or Vercel project settings (production):
              </p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-muted/50 p-2 text-[10px] font-mono">
{`TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=<your-generated-secret>`}
              </pre>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Register the webhook</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your production URL below, then run the command to register the webhook with Telegram:
              </p>
              <div className="mt-2 flex gap-2">
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-domain.com"
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={handleRegisterWebhook}>
                  Show command
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test webhook */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Test Webhook</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Verify the webhook endpoint is live and the bot token is valid.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={handleTestWebhook}
          disabled={testing || !overview.telegramConfigured}
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
          Test Connection
        </Button>
        {!overview.telegramConfigured && (
          <p className="mt-2 text-xs text-warning">⚠ Bot token not configured — set TELEGRAM_BOT_TOKEN first.</p>
        )}
      </div>

      {/* Bot behavior info */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <h3 className="text-sm font-semibold text-info">How the bot works</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          When a user messages your Telegram bot, the webhook at <code className="rounded bg-muted px-1 py-0.5 text-[10px]">/api/telegram/webhook</code> receives the message and:
        </p>
        <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>1. Greets the user and asks for their name</li>
          <li>2. Asks for their phone number (with a share-contact button)</li>
          <li>3. Creates a lead in the SVMS with source = "Telegram"</li>
          <li>4. The lead appears in Admin → Leads with status "New"</li>
          <li>5. Admin reviews + approves the lead → counselor is assigned</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Duplicate leads are automatically detected (by Telegram user ID or conversation ID).
        </p>
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
