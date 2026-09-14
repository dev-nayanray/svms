"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StageChangeForm({
  applicationId,
  stages,
  currentStage,
}: {
  applicationId: string;
  stages: { key: string; label: string }[];
  currentStage: string;
}) {
  const router = useRouter();
  const [stageKey, setStageKey] = useState(currentStage);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/applications/${applicationId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageKey, note: note || undefined }),
        });
        setLoading(false);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? "Failed to update stage");
          return;
        }
        setNote("");
        router.refresh();
      }}
    >
      <select
        value={stageKey}
        onChange={(e) => setStageKey(e.target.value)}
        aria-label="New stage"
        className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
      >
        {stages.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="min-h-[60px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Updating…" : "Update stage"}
      </button>
    </form>
  );
}
