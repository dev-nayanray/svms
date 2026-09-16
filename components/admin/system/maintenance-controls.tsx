"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState, ConfirmDialog } from "@/components/shared/page-kit";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { SectionCard, StatusBadge } from "./shared";
import { Wrench, AlertTriangle, Power, Clock, Settings } from "lucide-react";

type MaintenanceStatus = {
  active: boolean;
  title: string;
  message: string;
  startedAt: string | null;
  expectedEndAt: string | null;
  allowAdminAccess: boolean;
  showContactButton: boolean;
  contactButtonText: string;
  contactButtonUrl: string;
  showSocialLinks: boolean;
  windowId: string | null;
};

export function MaintenanceControls() {
  const { data, isPending, refetch } = useQuery({
    queryKey: ["/api/admin/system/maintenance"],
    queryFn: () => apiFetch<MaintenanceStatus>("/api/admin/system/maintenance"),
    staleTime: 10 * 1000,
  });

  const [enableOpen, setEnableOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  if (isPending) return <LoadingState label="Loading maintenance status…" />;
  if (!data) return <p className="text-destructive">Failed to load status.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Mode"
        description="Put the application into maintenance mode. Public users see a branded maintenance page; admins can still log in."
        breadcrumbs={["Admin", "System Operations", "Maintenance"]}
        actions={
          <div className="flex gap-2">
            {data.active && (
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4" /> Edit Settings
              </Button>
            )}
            <Button variant="outline" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
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
              Title: <strong>{data.title}</strong>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Message: <em>&ldquo;{data.message}&rdquo;</em>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Contact button: {data.showContactButton ? `Yes — "${data.contactButtonText}" → ${data.contactButtonUrl}` : "Hidden"}
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
            <span>Public marketing pages redirect to <code>/maintenance</code> — a branded standalone page.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning" />
            <span>Student + Employee operations that mutate data return HTTP 503 Service Unavailable.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" />
            <span>{data.allowAdminAccess ? "Admin panel (/admin) remains accessible for the duration." : "Admin panel also blocked."}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" />
            <span>Every enable/disable/settings change is recorded in the audit log + triggers cache revalidation.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" />
            <span>The maintenance page shows: logo, title, message, contact button, social links, expected return time.</span>
          </li>
        </ul>
      </SectionCard>

      <EnableDialog open={enableOpen} onOpenChange={setEnableOpen} />
      {data.active && (
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} current={data} />
      )}
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

type FormData = {
  title: string;
  message: string;
  expectedEndAt: string;
  allowAdminAccess: boolean;
  showContactButton: boolean;
  contactButtonText: string;
  contactButtonUrl: string;
  showSocialLinks: boolean;
};

const DEFAULT_FORM: FormData = {
  title: "We'll be back soon",
  message: "We're currently performing scheduled maintenance to improve your Euroscope experience. We'll be back shortly.",
  expectedEndAt: "",
  allowAdminAccess: true,
  showContactButton: true,
  contactButtonText: "Contact Support",
  contactButtonUrl: "/contact",
  showSocialLinks: true,
};

function EnableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { ...form };
      if (form.expectedEndAt) body.expectedEndAt = new Date(form.expectedEndAt).toISOString();
      delete (body as { expectedEndAt?: string }).expectedEndAt;
      if (form.expectedEndAt) body.expectedEndAt = new Date(form.expectedEndAt).toISOString();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Enable Maintenance Mode" description="Public users will see the maintenance page until you disable it." className="max-w-lg">
        <MaintenanceForm form={form} setForm={setForm} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.message}>
            {mutation.isPending ? "Enabling…" : "Enable Now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ open, onOpenChange, current }: { open: boolean; onOpenChange: (v: boolean) => void; current: MaintenanceStatus }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormData>({
    title: current.title,
    message: current.message,
    expectedEndAt: current.expectedEndAt ? current.expectedEndAt.slice(0, 16) : "",
    allowAdminAccess: current.allowAdminAccess,
    showContactButton: current.showContactButton,
    contactButtonText: current.contactButtonText,
    contactButtonUrl: current.contactButtonUrl,
    showSocialLinks: current.showSocialLinks,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { ...form };
      if (form.expectedEndAt) body.expectedEndAt = new Date(form.expectedEndAt).toISOString();
      else body.expectedEndAt = null;
      return apiFetch("/api/admin/system/maintenance", { method: "PATCH", json: body });
    },
    onSuccess: () => {
      toast({ title: "Settings updated", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/maintenance"] });
      onOpenChange(false);
    },
    onError: (err) => toast({ title: "Failed", description: (err as Error).message, variant: "error" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit Maintenance Settings" description="Update the maintenance page content. Changes appear immediately." className="max-w-lg">
        <MaintenanceForm form={form} setForm={setForm} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceForm({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
      <div className="space-y-1">
        <Label>Maintenance title</Label>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="We'll be back soon" />
      </div>
      <div className="space-y-1">
        <Label>Maintenance message</Label>
        <Textarea value={form.message} onChange={(e) => set("message", e.target.value)} rows={3} maxLength={500} />
      </div>
      <div className="space-y-1">
        <Label>Expected end time (optional)</Label>
        <Input type="datetime-local" value={form.expectedEndAt} onChange={(e) => set("expectedEndAt", e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.allowAdminAccess} onChange={(e) => set("allowAdminAccess", e.target.checked)} className="h-4 w-4" />
        Allow admin access during maintenance
      </label>
      <div className="border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.showContactButton} onChange={(e) => set("showContactButton", e.target.checked)} className="h-4 w-4" />
          Show contact button on maintenance page
        </label>
        {form.showContactButton && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Button text</Label>
              <Input value={form.contactButtonText} onChange={(e) => set("contactButtonText", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Button URL</Label>
              <Input value={form.contactButtonUrl} onChange={(e) => set("contactButtonUrl", e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.showSocialLinks} onChange={(e) => set("showSocialLinks", e.target.checked)} className="h-4 w-4" />
        Show social media links on maintenance page
      </label>
    </div>
  );
}
