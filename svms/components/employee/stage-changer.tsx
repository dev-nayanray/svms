"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight } from "lucide-react";
import { Button, Select, Label, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";
import { titleCase } from "@/lib/utils";

export function StageChanger({
  applicationId,
  currentStage,
  canEdit,
}: {
  applicationId: string;
  currentStage: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [stage, setStage] = useState(currentStage);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (stage === currentStage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employee/applications/${applicationId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({ title: "Stage changed", description: `${data.data.fromStage} → ${data.data.toStage}`, variant: "success" });
      setNote("");
      router.refresh();
    } catch (err) {
      toast({ title: "Could not change stage", description: err instanceof Error ? err.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="info">{titleCase(currentStage)}</Badge>
        <span className="text-xs text-muted-foreground">Read-only</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Change stage</Label>
          <Select value={stage} onChange={(e) => setStage(e.target.value)} disabled={saving}>
            {APPLICATION_STAGES.map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </Select>
        </div>
        <Button onClick={submit} disabled={saving || stage === currentStage} size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          Apply
        </Button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for this transition…"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={saving}
        maxLength={2000}
      />
    </div>
  );
}
