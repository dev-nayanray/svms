"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

/** Small × button on an application case note. */
export function DeleteNoteButton({
  applicationId,
  noteId,
}: {
  applicationId: string;
  noteId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
      disabled={busy}
      aria-label="Delete note"
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await apiFetch(`/api/applications/${applicationId}/notes/${noteId}`, {
            method: "DELETE",
          });
          toast({ title: "Note deleted", variant: "success" });
          router.refresh();
        } catch (err) {
          toast({ title: "Failed", description: (err as Error).message, variant: "error" });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "…" : "Delete"}
    </Button>
  );
}
