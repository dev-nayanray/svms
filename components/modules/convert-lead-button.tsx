"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          const res = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
          setLoading(false);
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            setError(body?.error?.message ?? "Failed to convert");
            return;
          }
          router.refresh();
        }}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        {loading ? "Converting…" : "Convert"}
      </button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
