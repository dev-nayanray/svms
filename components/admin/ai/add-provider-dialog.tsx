"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Button, Input, Label, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Plus, Loader2 } from "lucide-react";

// Provider presets — auto-filled when the admin selects a provider type
const PROVIDER_PRESETS: Record<string, {
  name: string;
  baseUrl: string;
  defaultModel: string;
  apiKeyPlaceholder: string;
  showBaseUrl: boolean;
  models: Array<{ modelId: string; name: string }>;
}> = {
  openai: {
    name: "OpenAI",
    baseUrl: "",
    defaultModel: "gpt-4o-mini",
    apiKeyPlaceholder: "sk-...",
    showBaseUrl: false,
    models: [
      { modelId: "gpt-4o", name: "GPT-4o" },
      { modelId: "gpt-4o-mini", name: "GPT-4o mini" },
      { modelId: "gpt-4-turbo", name: "GPT-4 Turbo" },
    ],
  },
  anthropic: {
    name: "Anthropic Claude",
    baseUrl: "",
    defaultModel: "claude-3-5-sonnet-20241022",
    apiKeyPlaceholder: "sk-ant-...",
    showBaseUrl: false,
    models: [
      { modelId: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
      { modelId: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
      { modelId: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3.8-flash",
    apiKeyPlaceholder: "AIza...",
    showBaseUrl: true,
    models: [
      { modelId: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Latest)" },
      { modelId: "gemini-flash-latest", name: "Gemini Flash (Auto)" },
      { modelId: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Legacy)" },
      { modelId: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Legacy)" },
    ],
  },
  "openai-compatible": {
    name: "OpenAI-compatible",
    baseUrl: "",
    defaultModel: "",
    apiKeyPlaceholder: "API key",
    showBaseUrl: true,
    models: [],
  },
};

export function AddProviderDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [providerType, setProviderType] = useState<"openai" | "anthropic" | "gemini" | "openai-compatible">("openai");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("");

  const preset = PROVIDER_PRESETS[providerType];

  // When provider type changes, auto-fill the fields
  const handleProviderChange = (type: "openai" | "anthropic" | "gemini" | "openai-compatible") => {
    setProviderType(type);
    const p = PROVIDER_PRESETS[type];
    setName(p.name);
    setBaseUrl(p.baseUrl);
    setDefaultModel(p.defaultModel);
    setApiKey("");
  };

  const mutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/admin/ai/providers", {
        method: "POST",
        json: {
          provider: providerType,
          name: name || preset.name,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          defaultModel: defaultModel || undefined,
        },
      }),
    onSuccess: () => {
      toast({ title: "Provider added", description: "Don't forget to test the connection.", variant: "success" });
      onOpenChange(false);
      // Reset
      setName("");
      setApiKey("");
      setBaseUrl("");
      setDefaultModel("");
      onAdded();
    },
    onError: (err) => toast({ title: "Failed to add provider", description: (err as Error).message, variant: "error" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add AI Provider" className="max-w-md max-h-[85vh] overflow-y-auto">
        <div className="space-y-3">
          {/* Provider Type */}
          <div className="space-y-1">
            <Label>Provider Type</Label>
            <Select
              value={providerType}
              onChange={(e) => handleProviderChange(e.target.value as "openai" | "anthropic" | "gemini" | "openai-compatible")}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai-compatible">OpenAI-compatible (custom URL)</option>
            </Select>
          </div>

          {/* Display Name */}
          <div className="space-y-1">
            <Label>Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={preset.name} />
          </div>

          {/* API Key */}
          <div className="space-y-1">
            <Label>API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={preset.apiKeyPlaceholder}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Stored securely in the database. Never shown again after saving.
            </p>
          </div>

          {/* Base URL — shown for Gemini + OpenAI-compatible */}
          {preset.showBaseUrl && (
            <div className="space-y-1">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://..."
                className="font-mono text-xs"
              />
              {providerType === "gemini" && (
                <p className="text-xs text-muted-foreground">
                  Default: Google's Generative Language API. Don't change unless you know what you're doing.
                </p>
              )}
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-1">
            <Label>Default Model</Label>
            {preset.models.length > 0 ? (
              <Select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}>
                {preset.models.map((m) => (
                  <option key={m.modelId} value={m.modelId}>{m.name} ({m.modelId})</option>
                ))}
                <option value="">Custom model ID…</option>
              </Select>
            ) : (
              <Input
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="model-id"
                className="font-mono"
              />
            )}
            {/* Allow custom model ID input if "Custom" is selected */}
            {preset.models.length > 0 && defaultModel === "" && (
              <Input
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="Enter custom model ID"
                className="mt-1 font-mono text-xs"
              />
            )}
          </div>

          {/* Gemini warning */}
          {providerType === "gemini" && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
              <p className="font-medium text-warning">⚠ Gemini Region Restriction</p>
              <p className="mt-1 text-muted-foreground">
                Google Gemini API is geo-restricted. If you get a "User location is not supported" error,
                the API is blocked from your server's region. Use a VPN/proxy or deploy on Vercel
                (servers in US/EU where Gemini works).
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !apiKey}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Provider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}