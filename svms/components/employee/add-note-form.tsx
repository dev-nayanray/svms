"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pin } from "lucide-react";
import { Button, Label, Textarea, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

/**
 * Inline Add-Note form for the Student 360 Notes tab. Submits to
 * /api/employee/students/[id]/notes — the route enforces IDOR closure
 * server-side so the form only needs to send the body + visibility + pinned.
 *
 * On success the page router-refreshes so the new note appears in the list
 * above. Errors surface via the toast.
 */
export function AddNoteForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"INTERNAL" | "STUDENT">("INTERNAL");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employee/students/${studentId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, visibility, pinned }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({ title: "Note added", variant: "success" });
      setBody("");
      setPinned(false);
      router.refresh();
    } catch (err) {
      toast({
        title: "Could not add note",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="note-body">Add note</Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVisibility((v) => (v === "INTERNAL" ? "STUDENT" : "INTERNAL"))}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
            aria-pressed={visibility === "STUDENT"}
          >
            <Badge tone={visibility === "INTERNAL" ? "default" : "info"}>{visibility === "INTERNAL" ? "Internal" : "Student-visible"}</Badge>
          </button>
          <button
            type="button"
            onClick={() => setPinned((v) => !v)}
            className={`rounded-md border border-border px-2 py-1 text-xs font-medium ${pinned ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
            aria-pressed={pinned}
          >
            <Pin className="inline h-3 w-3" /> {pinned ? "Pinned" : "Pin"}
          </button>
        </div>
      </div>
      <Textarea
        id="note-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write a note about this student…"
        disabled={saving}
        maxLength={5000}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Internal notes are visible to staff only. Student-visible notes appear in the student portal.
        </p>
        <Button type="submit" size="sm" disabled={saving || !body.trim()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
          Add note
        </Button>
      </div>
    </form>
  );
}
