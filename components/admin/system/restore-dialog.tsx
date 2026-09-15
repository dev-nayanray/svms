"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Button, Input, Label } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { bytesToHuman, timeAgo } from "./shared";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";

const CONFIRMATION = "I UNDERSTAND THE RISK";

type Backup = {
  id: string;
  reference: string;
  type: string;
  status: string;
  sizeBytes: number | null;
  documentCount: number | null;
  verificationStatus: string | null;
  completedAt: string | null;
};

export function RestoreDialog({
  backup,
  open,
  onClose,
}: {
  backup: Backup;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [ack, setAck] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);

  const isVerified = backup.verificationStatus === "PASSED";

  const mutation = useMutation({
    mutationFn: async () =>
      apiFetch<{ totalInserted: number; totalSkipped: number; totalErrors: number; safetyBackupId?: string }>(
        `/api/admin/system/backups/${backup.id}/restore`,
        {
          method: "POST",
          json: {
            confirmation: confirm,
            acknowledgeUnverified: !isVerified ? ack : true,
            skipExisting,
          },
        },
      ),
    onSuccess: (data: { totalInserted: number; totalSkipped: number; totalErrors: number; safetyBackupId?: string }) => {
      toast({
        title: "Restore complete",
        description: `Inserted ${data.totalInserted}, skipped ${data.totalSkipped}, errors ${data.totalErrors}`,
        variant: "success",
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/backups"] });
      onClose();
      setConfirm("");
      setAck(false);
    },
    onError: (err) => toast({ title: "Restore failed", description: (err as Error).message, variant: "error" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Restore Backup" className="max-w-lg">
        <div className="space-y-4">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" /> High-risk operation
            </p>
            <p className="mt-1 text-xs text-destructive/80">
              This will overwrite data in your production database. A safety backup will be created first,
              but restoration is irreversible. Proceed only if you understand the consequences.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Reference</p>
                <p className="font-mono">{backup.reference}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p>{backup.status}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Size</p>
                <p>{backup.sizeBytes ? bytesToHuman(backup.sizeBytes) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Documents</p>
                <p>{backup.documentCount ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p>{backup.completedAt ? timeAgo(backup.completedAt) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Verified</p>
                <p>{backup.verificationStatus ?? "Not verified"}</p>
              </div>
            </div>
          </div>

          {!isVerified && (
            <label className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                This backup has NOT been verified. Restoring an unverified backup may fail or
                corrupt data. Acknowledge this risk to proceed.
              </span>
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Skip documents whose ID already exists (recommended)</span>
          </label>

          <div className="space-y-1">
            <Label htmlFor="confirm">Type the confirmation phrase</Label>
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRMATION}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Type <code className="font-mono">{CONFIRMATION}</code> to enable the restore button.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                mutation.isPending ||
                confirm !== CONFIRMATION ||
                (!isVerified && !ack)
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Restoring…
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" /> Restore Now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
