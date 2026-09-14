"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

/** Add a note to an application. INTERNAL notes are never shown to students. */
export function AddNoteForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("INTERNAL");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        try {
          await apiFetch(`/api/applications/${applicationId}/notes`, {
            method: "POST",
            json: { body: body.trim(), visibility },
          });
          toast({ title: "Note added", variant: "success" });
          setBody("");
          router.refresh();
        } catch (err) {
          toast({ title: "Failed", description: (err as Error).message, variant: "error" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="note-body">New note</Label>
        <Textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a case note…"
          required
        />
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="note-visibility">Visibility</Label>
          <select
            id="note-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          >
            <option value="INTERNAL">Internal (staff only)</option>
            <option value="STUDENT">Student-visible</option>
          </select>
        </div>
        <Button type="submit" disabled={busy || !body.trim()}>
          {busy ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
