"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Button, Input, Label, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { StatusBadge } from "./shared";
import { DatabaseBackup, Lock, Loader2 } from "lucide-react";

type Scope = { key: string; label: string; description: string };

export function CreateBackupDialog({
  open,
  onOpenChange,
  scopes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scopes: Scope[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState<"FULL" | "SELECTIVE" | "CONFIG">("FULL");
  const [selected, setSelected] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      const scope = type === "FULL" ? ["*"] : type === "CONFIG" ? ["Settings"] : selected;
      return apiFetch("/api/admin/system/backups", {
        method: "POST",
        json: { type, scope },
      });
    },
    onSuccess: () => {
      toast({ title: "Backup created", variant: "success" });
      onOpenChange(false);
      setSelected([]);
      setType("FULL");
      qc.invalidateQueries({ queryKey: ["/api/admin/system/backups"] });
    },
    onError: (err) => {
      toast({ title: "Backup failed", description: (err as Error).message, variant: "error" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create Backup" description="Backups are encrypted with AES-256-GCM via AUTH_SECRET.">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Backup Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as "FULL" | "SELECTIVE" | "CONFIG")}>
              <option value="FULL">Full Database (all collections)</option>
              <option value="SELECTIVE">Selective (choose collections)</option>
              <option value="CONFIG">Configuration only</option>
            </Select>
          </div>

          {type === "SELECTIVE" && (
            <div className="space-y-2">
              <Label>Select scopes to include</Label>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border p-2">
                {scopes.map((s) => (
                  <label key={s.key} className="flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-muted">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.includes(s.key)}
                      onChange={(e) => {
                        if (e.target.checked) setSelected([...selected, s.key]);
                        else setSelected(selected.filter((x) => x !== s.key));
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selected.length} scope(s) selected
              </p>
            </div>
          )}

          <div className="rounded-md border border-info/30 bg-info/5 p-3 text-xs">
            <p className="flex items-center gap-1 font-medium">
              <Lock className="h-3 w-3" /> Encryption
            </p>
            <p className="mt-1 text-muted-foreground">
              All backups are encrypted at rest. The encryption key is derived from <code className="text-[10px]">AUTH_SECRET</code> — keep this env var safe.
              Passwords and authentication secrets are stripped before backup.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || (type === "SELECTIVE" && selected.length === 0)}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <DatabaseBackup className="h-4 w-4" /> Create Backup
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

void StatusBadge;
void Input;
