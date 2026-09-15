"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState, ConfirmDialog } from "@/components/shared/page-kit";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { SectionCard, StatusBadge } from "./shared";
import { Wrench, AlertTriangle, Power, Clock } from "lucide-react";

type MaintenanceStatus = {
  active: boolean;
  message: string;
  startedAt: string | null;
  expectedEndAt: string | null;
  allowAdminAccess: boolean;
  windowId: string | null;
};

export function MaintenanceControls() {
  const { data, isPending, refetch } = useQuery({
    queryKey: ["/api/admin/system/maintenance"],
    queryFn: () => apiFetch<MaintenanceStatus>("/api/admin/system/maintenance"),
    staleTime: 10 * 1000,
  });

  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  if (isPending) return <LoadingState label="Loading maintenance status…" />;
  if (!data) return <p className="text-destructive">Failed to load status.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Mode"
        description="Put the application into maintenance mode. Public users see a maintenance page; admins can still log in."
        breadcrumbs={["Admin", "System Administration", "Maintenance"]}
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <SectionCard
        title="Current Status"
        description="Real-time status of maintenance mode."
        actions={<Wrench className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode</p>
            <p className="mt-2">
              <StatusBadge status={data.active ? "warning" : "healthy"} label={data.active ? "ACTIVE" : "Off"} />
            </p>
          </div>
          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Started</p>
            <p className="mt-2 text-sm font-medium">
              {data.startedAt ? new Date(data.startedAt).toLocaleString("en-GB") : "—"}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected End</p>
            <p className="mt-2 text-sm font-medium">
              {data.expectedEndAt ? new Date(data.expectedEndAt).toLocaleString("en-GB") : "—"}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin Access</p>
            <p className="mt-2">
              <StatusBadge status={data.allowAdminAccess ? "healthy" : "warning"} label={data.allowAdminAccess ? "Allowed" : "Blocked"} />
            </p>
          </div>
        </div>

        {data.active && (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-warning">
              <AlertTriangle className="h-4 w-4" /> Maintenance mode is currently ACTIVE
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Public users see a maintenance page. {data.allowAdminAccess ? "Admins can still access /admin." : "Admin access also blocked."}
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {!data.active ? (
            <Button variant="destructive" onClick={() => setEnableOpen(true)}>
              <Power className="h-4 w-4" /> Enable Maintenance
            </Button>
          ) : (
            <Button onClick={() => setDisableOpen(true)}>
              <Power className="h-4 w-4" /> Disable Maintenance
            </Button>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Behavior When Active"
        description="What happens when maintenance mode is enabled."
        actions={<Clock className="h-4 w-4 text-muted-foreground" />}
      >
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning" />
            <span>Public marketing pages render a maintenance screen instead of normal content.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning" />
            <span>Student + Employee operations that mutate data return HTTP 503 Service Unavailable.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning" />
            <span>APIs respond with 503 + <code>{`{ success: false, error: { code: "MAINTENANCE_MODE" } }`}</code></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" />
            <span>{data.allowAdminAccess ? "Admin panel (/admin) remains accessible for the duration." : "Admin panel also blocked (rare — use with caution)."}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" />
            <span>Every enable/disable action is recorded in the audit log with IP + user agent.</span>
          </li>
        </ul>
      </SectionCard>

      <EnableDialog open={enableOpen} onOpenChange={setEnableOpen} />
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable maintenance mode?"
        message="Public users will immediately regain access. Are you sure you're done with maintenance?"
        confirmLabel="Disable"
        onConfirm={async () => {
          await apiFetch("/api/admin/system/maintenance", { method: "DELETE" });
        }}
      />
    </div>
  );
}

function EnableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [message, setMessage] = useState(
    "We are performing scheduled maintenance. Euroscope will be back shortly. Thank you for your patience.",
  );
  const [expectedEndAt, setExpectedEndAt] = useState("");
  const [allowAdminAccess, setAllowAdminAccess] = useState(true);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { message, allowAdminAccess };
      if (expectedEndAt) body.expectedEndAt = new Date(expectedEndAt).toISOString();
      return apiFetch("/api/admin/system/maintenance", { method: "POST", json: body });
    },
    onSuccess: () => {
      toast({ title: "Maintenance enabled", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/maintenance"] });
      onOpenChange(false);
    },
    onError: (err) => toast({ title: "Failed to enable", description: (err as Error).message, variant: "error" }),
  });

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Enable Maintenance Mode</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Public users will see the maintenance page until you disable it.
            </p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>Maintenance message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>
              <div className="space-y-1">
                <Label>Expected end time (optional)</Label>
                <Input
                  type="datetime-local"
                  value={expectedEndAt}
                  onChange={(e) => setExpectedEndAt(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowAdminAccess}
                  onChange={(e) => setAllowAdminAccess(e.target.checked)}
                  className="h-4 w-4"
                />
                Allow admin access during maintenance
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending || !message}>
                {mutation.isPending ? "Enabling…" : "Enable Now"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
