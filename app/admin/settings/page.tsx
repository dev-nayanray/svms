"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-kit";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "@/components/ui";
import { Skeleton } from "@/components/ui/overlays";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Save } from "lucide-react";

type Setting = { id: string; key: string; value: unknown };

const KNOWN_SETTINGS: { key: string; label: string; placeholder: string }[] = [
  { key: "company_name", label: "Company name", placeholder: "Badhan Education Consultancy" },
  { key: "company_email", label: "Company email", placeholder: "info@example.com" },
  { key: "company_phone", label: "Company phone", placeholder: "+880 …" },
  { key: "company_address", label: "Company address", placeholder: "Dhaka, Bangladesh" },
  { key: "default_currency", label: "Default currency", placeholder: "BDT" },
  { key: "invoice_prefix", label: "Invoice prefix", placeholder: "INV" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiFetch<{ data: Setting[] }>("/api/settings"),
  });

  const valueOf = (key: string): string => {
    if (key in draft) return draft[key];
    const found = data?.data.find((s) => s.key === key);
    return typeof found?.value === "string" ? found.value : "";
  };

  const save = async (key: string) => {
    setBusy(key);
    try {
      await apiFetch("/api/settings", { method: "PUT", json: { key, value: valueOf(key) } });
      toast({ title: "Setting saved", variant: "success" });
      setDraft((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="System Settings"
        description="Company defaults and system configuration. All changes are audit-logged."
        breadcrumbs={["Admin", "Settings"]}
      />
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPending && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          {KNOWN_SETTINGS.map((s) => (
            <div key={s.key} className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1 space-y-1">
                <Label htmlFor={`set-${s.key}`}>{s.label}</Label>
                <Input
                  id={`set-${s.key}`}
                  value={valueOf(s.key)}
                  placeholder={s.placeholder}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === s.key || !(s.key in draft)}
                onClick={() => save(s.key)}
              >
                <Save className="h-4 w-4" aria-hidden /> {busy === s.key ? "Saving…" : "Save"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
