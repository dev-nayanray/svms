"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, ConfirmDialog } from "@/components/shared/page-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { StatusBadge, SectionCard, bytesToHuman, timeAgo, msToHuman } from "./shared";
import { CreateBackupDialog } from "./create-backup-dialog";
import { RestoreDialog } from "./restore-dialog";
import { DatabaseBackup, Download, ShieldCheck, Trash2, RotateCcw, CheckCircle2 } from "lucide-react";

type Backup = {
  id: string;
  reference: string;
  type: string;
  scope: string[];
  status: string;
  storageProvider: string;
  encrypted: boolean;
  sizeBytes: number | null;
  documentCount: number | null;
  durationMs: number | null;
  verificationStatus: string | null;
  startedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  createdBy: { name: string; email: string } | null;
  trigger: string;
};

type Scope = { key: string; label: string; description: string };

export function BackupHistory() {
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: scopeData } = useQuery({
    queryKey: ["/api/admin/system/backups", "scopes"],
    queryFn: async () => {
      const res = await apiFetch<{ scopes: Scope[] }>("/api/admin/system/backups?pageSize=1");
      return res.scopes;
    },
    staleTime: 5 * 60 * 1000,
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/admin/system/backups/${id}/verify`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Verification complete", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/backups"] });
    },
    onError: (err) => toast({ title: "Verification failed", description: (err as Error).message, variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/admin/system/backups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Backup deleted", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/backups"] });
    },
    onError: (err) => toast({ title: "Delete failed", description: (err as Error).message, variant: "error" }),
  });

  const columns: Column<Backup>[] = [
    {
      key: "reference",
      header: "Backup ID",
      sortable: true,
      render: (b) => (
        <div>
          <p className="font-mono text-xs font-medium">{b.reference}</p>
          <p className="text-xs text-muted-foreground">{b.trigger}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (b) => (
        <div>
          <span className="text-xs font-medium">{b.type}</span>
          {b.scope.length > 0 && b.scope[0] !== "*" && (
            <p className="text-xs text-muted-foreground">
              {b.scope.length} scope(s)
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (b) => (
        <div className="flex flex-col gap-1">
          <StatusBadge
            status={
              b.status === "COMPLETED" || b.status === "VERIFIED"
                ? "healthy"
                : b.status === "RUNNING" || b.status === "VERIFYING"
                  ? "warning"
                  : b.status === "FAILED"
                    ? "critical"
                    : "unknown"
            }
            label={b.status}
          />
          {b.verificationStatus === "PASSED" && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3 w-3" /> Verified
            </span>
          )}
        </div>
      ),
    },
    {
      key: "sizeBytes",
      header: "Size",
      sortable: true,
      render: (b) => (
        <div>
          <p className="text-xs font-medium tabular-nums">{b.sizeBytes ? bytesToHuman(b.sizeBytes) : "—"}</p>
          {b.documentCount != null && (
            <p className="text-xs text-muted-foreground">{b.documentCount} docs</p>
          )}
        </div>
      ),
    },
    {
      key: "createdBy",
      header: "Created By",
      render: (b) => (
        <div className="text-xs">
          <p className="font-medium">{b.createdBy?.name ?? "—"}</p>
          {b.createdBy?.email && (
            <p className="text-muted-foreground">{b.createdBy.email}</p>
          )}
        </div>
      ),
    },
    {
      key: "completedAt",
      header: "Completed",
      sortable: true,
      render: (b) => (
        <div className="text-xs">
          <p>{b.completedAt ? timeAgo(b.completedAt) : "—"}</p>
          {b.durationMs && <p className="text-muted-foreground">{msToHuman(b.durationMs)}</p>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (b) => (
        <div className="flex flex-wrap items-center gap-1">
          <a
            href={`/api/admin/system/backups/${b.id}/download`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            title="Verify"
            disabled={verifyMutation.isPending || b.status === "RUNNING"}
            onClick={() => verifyMutation.mutate(b.id)}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            title="Restore"
            disabled={b.status !== "COMPLETED" && b.status !== "VERIFIED"}
            onClick={() => setRestoreTarget(b)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7"
            title="Delete"
            onClick={() => setDeleteTarget(b)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Backup & Restore"
        description="Create, verify, download, and restore database backups. Encrypted at rest with AES-256-GCM."
        breadcrumbs={["Admin", "System Administration", "Backups"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <DatabaseBackup className="h-4 w-4" /> Create Backup
          </Button>
        }
      />

      <SectionCard
        title="Backup History"
        description="All backups (manual + scheduled) — paginated server-side."
      >
        <DataTable
          endpoint="/api/admin/system/backups"
          columns={columns}
          searchPlaceholder="Search by reference…"
          emptyMessage="No backups yet. Click 'Create Backup' to make your first one."
          emptyAction={
            <Button onClick={() => setCreateOpen(true)}>
              <DatabaseBackup className="h-4 w-4" /> Create First Backup
            </Button>
          }
        />
      </SectionCard>

      <CreateBackupDialog open={createOpen} onOpenChange={setCreateOpen} scopes={scopeData ?? []} />

      {restoreTarget && (
        <RestoreDialog backup={restoreTarget} open onClose={() => setRestoreTarget(null)} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete backup?"
        message={`This will permanently delete ${deleteTarget?.reference}. The system refuses to delete the only known valid backup — make sure you have at least one other backup first.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMutation.mutateAsync(deleteTarget.id);
        }}
      />
    </div>
  );
}
