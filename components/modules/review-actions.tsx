"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const review = async (decision: "APPROVED" | "REJECTED") => {
    const note =
      decision === "REJECTED" ? window.prompt("Rejection note (shown to the student):") ?? "" : "";
    setLoading(true);
    await fetch(`/api/documents/${documentId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reviewNote: note || undefined }),
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex gap-1.5">
      <button
        disabled={loading}
        onClick={() => review("APPROVED")}
        className="rounded-md bg-success/15 px-2 py-1 text-xs font-medium text-success hover:bg-success/25 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={loading}
        onClick={() => review("REJECTED")}
        className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
