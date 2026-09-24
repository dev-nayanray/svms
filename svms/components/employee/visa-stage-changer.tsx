"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight, CheckCircle2, Lock } from "lucide-react";
import { Button, Select, Label, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { VISA_STAGES } from "@/lib/services/visa-cases";
import { titleCase, cn } from "@/lib/utils";

export function VisaStageChanger({
  visaId,
  currentStage,
  canEdit,
}: {
  visaId: string;
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
      const res = await fetch(`/api/employee/visa/${visaId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({ title: "Visa stage changed", description: `${data.data.fromStage} → ${data.data.toStage}`, variant: "success" });
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

  const isTerminal = ["APPROVED", "COMPLETED"].includes(currentStage);

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted/30 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current</span>
          <Badge tone="info">{titleCase(currentStage)}</Badge>
        </div>
      </div>

      {isTerminal && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>This visa application has reached a terminal stage. No further transitions are allowed.</span>
        </div>
      )}

      {!isTerminal && (
        <>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Change stage</Label>
              <Select value={stage} onChange={(e) => setStage(e.target.value)} disabled={saving}>
                {VISA_STAGES.map((s) => (
                  <option key={s} value={s} disabled={s === currentStage}>{titleCase(s)}{s === currentStage ? " (current)" : ""}</option>
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
            placeholder="Note for this transition (required for decision stages)…"
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={saving}
            maxLength={2000}
          />

          {/* Stage map */}
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stage map</p>
            <ul className="space-y-0.5">
              {VISA_STAGES.map((s, i) => {
                const currentIdx = VISA_STAGES.indexOf(currentStage as (typeof VISA_STAGES)[number]);
                const isPast = i < currentIdx;
                const isCurrent = s === currentStage;
                const isForward = i === currentIdx + 1;
                const isTerminal_ = s === "APPROVED" || s === "COMPLETED";
                return (
                  <li key={s} className={cn(
                    "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs",
                    isCurrent && "bg-primary/10 text-primary font-medium",
                    isPast && "text-muted-foreground/60",
                    isForward && !isTerminal_ && "text-foreground",
                  )}>
                    {isPast ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : isCurrent ? <span className="h-2 w-2 rounded-full bg-primary" /> : <Lock className="h-3 w-3 text-muted-foreground/40" aria-hidden />}
                    {titleCase(s)}
                    {isPast && <span className="text-[10px] text-muted-foreground">(done)</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
