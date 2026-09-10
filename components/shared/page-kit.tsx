"use client";

import { useState } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: string[];
}) {
  return (
    <div className="space-y-1">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            {breadcrumbs.map((b, i) => (
              <li key={b} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                <span className={i === breadcrumbs.length - 1 ? "text-foreground" : undefined}>{b}</span>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} className="max-w-md">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type FormField =
  | { type: "text" | "email" | "number" | "date" | "password"; name: string; label: string; required?: boolean; placeholder?: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[]; required?: boolean }
  | { type: "textarea"; name: string; label: string; required?: boolean; placeholder?: string };

/**
 * Generic create/edit dialog. Submits JSON to `endpoint` (POST create / PATCH ${endpoint}/${id} edit)
 * and invalidates the table query on success.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  endpoint,
  entityId,
  invalidateKey,
  successMessage = "Saved successfully",
  toPayload,
  extraPayload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  endpoint: string;
  entityId?: string;
  invalidateKey: string;
  successMessage?: string;
  toPayload?: (values: Record<string, string>) => Record<string, unknown>;
  extraPayload?: Record<string, unknown>;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFieldErrors({});
    try {
      const payload = { ...(extraPayload ?? {}), ...(toPayload ? toPayload(values) : values) };
      await apiFetch(entityId ? `${endpoint}/${entityId}` : endpoint, {
        method: entityId ? "PATCH" : "POST",
        json: payload,
      });
      toast({ title: successMessage, variant: "success" });
      onOpenChange(false);
      setValues({});
      qc.invalidateQueries({ queryKey: [invalidateKey] });
    } catch (err) {
      const msg = (err as Error).message;
      // surface "field: message" pairs from the validation envelope
      const match = msg.match(/\((.+)\)$/);
      if (match) {
        const fe: Record<string, string> = {};
        for (const part of match[1].split("; ")) {
          fe[part] = part;
        }
        setFieldErrors(fe);
      }
      toast({ title: "Save failed", description: msg, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <form onSubmit={submit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={`f-${f.name}`}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              {f.type === "select" ? (
                <Select
                  id={`f-${f.name}`}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  required={f.required}
                >
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea
                  id={`f-${f.name}`}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  required={f.required}
                  placeholder={f.placeholder}
                />
              ) : (
                <Input
                  id={`f-${f.name}`}
                  type={f.type}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  required={f.required}
                  placeholder={f.placeholder}
                />
              )}
              {fieldErrors[f.name] && (
                <p className="text-xs text-destructive">{fieldErrors[f.name]}</p>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : entityId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-4">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded bg-muted" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
