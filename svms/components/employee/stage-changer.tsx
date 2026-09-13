"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { Button, Select, Label, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";
import { titleCase, cn } from "@/lib/utils";

type TransitionPreview = {
  toStage: string;
  allowed: boolean;
  block: { code: string; reason: string } | null;
};

type TransitionsResponse = {
  currentStage: string;
  previews: TransitionPreview[];
};

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
  const [previews, setPreviews] = useState<TransitionsResponse | null>(null);

  // Fetch transition previews on mount — the server evaluates the rules
  // and tells the client which stages are allowed / blocked + why.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/employee/applications/${applicationId}/transitions`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.success) {
          setPreviews(body.data);
        }
      })
      .catch(() => {
        // Non-fatal — the selector still works without previews.
      });
    return () => { cancelled = true; };
  }, [applicationId]);

  const submit = async () => {
    if (stage === currentStage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employee/applications/${applicationId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          note: note.trim() || undefined,
          expectedFromStage: currentStage, // concurrency guard
        }),
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

  // Find the preview for the currently-selected target stage
  const selectedPreview = previews?.previews.find((p) => p.toStage === stage);
  const isBlocked = selectedPreview && !selectedPreview.allowed;

  // Determine the next allowed stage (the immediate forward successor that is allowed)
  const nextAllowed = previews?.previews.find(
    (p) => p.allowed && APPLICATION_STAGES.indexOf(p.toStage as (typeof APPLICATION_STAGES)[number]) === APPLICATION_STAGES.indexOf(currentStage as (typeof APPLICATION_STAGES)[number]) + 1,
  );

  return (
    <div className="space-y-3">
      {/* Current stage + next stage summary */}
      <div className="rounded-md bg-muted/30 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current</span>
          <Badge tone="info">{titleCase(currentStage)}</Badge>
        </div>
        {nextAllowed && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Next allowed</span>
            <Badge tone="success">{titleCase(nextAllowed.toStage)}</Badge>
          </div>
        )}
        {!nextAllowed && currentStage !== "COMPLETED" && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Next</span>
            <span className="text-xs text-muted-foreground">Blocked — see below</span>
          </div>
        )}
        {currentStage === "COMPLETED" && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge tone="success"><CheckCircle2 className="h-3 w-3" aria-hidden /> Completed</Badge>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Change stage</Label>
          <Select value={stage} onChange={(e) => setStage(e.target.value)} disabled={saving}>
            {APPLICATION_STAGES.map((s) => {
              const preview = previews?.previews.find((p) => p.toStage === s);
              const blocked = preview && !preview.allowed;
              const isCurrent = s === currentStage;
              return (
                <option key={s} value={s}>
                  {titleCase(s)}{isCurrent ? " (current)" : blocked ? " — blocked" : ""}
                </option>
              );
            })}
          </Select>
        </div>
        <Button onClick={submit} disabled={saving || stage === currentStage || !!isBlocked} size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          Apply
        </Button>
      </div>

      {/* Blocked reason */}
      {isBlocked && selectedPreview?.block && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Transition blocked: {selectedPreview.block.code}</p>
            <p className="mt-0.5">{selectedPreview.block.reason}</p>
          </div>
        </div>
      )}

      {/* Allowed indicator */}
      {selectedPreview && selectedPreview.allowed && stage !== currentStage && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Transition allowed</p>
            <p className="mt-0.5">All preconditions are met. Apply to move the application to {titleCase(stage)}.</p>
          </div>
        </div>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for this transition…"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={saving}
        maxLength={2000}
      />

      {/* Preview list — all stages with their blocked/allowed status */}
      {previews && (
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Transition map
          </p>
          <ul className="space-y-1">
            {previews.previews.map((p) => {
              const idx = APPLICATION_STAGES.indexOf(p.toStage as (typeof APPLICATION_STAGES)[number]);
              const currentIdx = APPLICATION_STAGES.indexOf(currentStage as (typeof APPLICATION_STAGES)[number]);
              const isPast = idx < currentIdx;
              const isForward = idx === currentIdx + 1;
              return (
                <li
                  key={p.toStage}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1 text-xs",
                    isPast && "bg-success/5 text-muted-foreground",
                    isForward && p.allowed && "bg-success/10 text-success",
                    isForward && !p.allowed && "bg-destructive/5",
                    !isForward && !isPast && "text-muted-foreground/60",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {p.allowed ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    ) : (
                      <Lock className="h-3 w-3" aria-hidden />
                    )}
                    {titleCase(p.toStage)}
                    {isPast && <span className="text-[10px]">(completed)</span>}
                  </span>
                  {!p.allowed && p.block && (
                    <span className="text-[10px] text-destructive">{p.block.code}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
