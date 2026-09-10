"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";
import { LEAD_STATUSES, LEAD_SOURCES, LEAD_SOURCE_LABELS } from "@/lib/constants/leads";

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  interestedCountry: string | null;
  preferredIntake: string | null;
  archivedAt: string | null;
  createdAt: string;
  employee?: { user?: { name?: string } } | null;
};

type EmployeeOption = { id: string; user: { id: string; name: string } };
type CountryOption = { id: string; name: string };

const statusOptions = LEAD_STATUSES.map((s) => ({ value: s, label: s }));
const sourceOptions = LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] }));

export function LeadsAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/leads"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [assignLead, setAssignLead] = useState<Lead | null>(null);
  const [statusLead, setStatusLead] = useState<Lead | null>(null);
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [archiveLead, setArchiveLead] = useState<Lead | null>(null);

  const [showArchived, setShowArchived] = useState(false);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["/api/employees", "options"],
    queryFn: () => apiFetch<{ data: EmployeeOption[] }>("/api/employees?pageSize=100"),
  });
  const { data: countries } = useQuery({
    queryKey: ["/api/countries", "options"],
    queryFn: () => apiFetch<{ data: CountryOption[] }>("/api/countries"),
  });

  const employeeOptions = (employees?.data ?? []).map((e) => ({ value: e.id, label: e.user.name }));
  const countryOptions = (countries?.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  const staticParams = useMemo(() => {
    const p: Record<string, string> = { archived: showArchived ? "true" : "false" };
    if (createdFrom) p.createdFrom = createdFrom;
    if (createdTo) p.createdTo = createdTo;
    return p;
  }, [showArchived, createdFrom, createdTo]);

  const baseFields: FormField[] = [
    { type: "text", name: "name", label: "Name", required: true },
    { type: "email", name: "email", label: "Email (required to convert)" },
    { type: "text", name: "phone", label: "Phone" },
    { type: "select", name: "source", label: "Source", options: sourceOptions },
    { type: "select", name: "status", label: "Status", options: statusOptions },
    { type: "select", name: "interestedCountry", label: "Interested country", options: countryOptions },
    { type: "text", name: "preferredIntake", label: "Preferred intake", placeholder: "September 2027" },
    { type: "text", name: "educationLevel", label: "Education level", placeholder: "HSC / BACHELOR" },
    { type: "text", name: "englishScore", label: "English score", placeholder: "IELTS 6.5" },
    { type: "select", name: "assignedEmployeeId", label: "Assigned employee", options: employeeOptions },
    { type: "textarea", name: "notes", label: "Notes" },
  ];

  const columns: Column<Lead>[] = [
    {
      key: "name", header: "Name", sortable: true,
      render: (l) => (
        <Link href={`/admin/leads/${l.id}`} className="font-medium text-primary hover:underline">
          {l.name}
        </Link>
      ),
    },
    { key: "email", header: "Email", render: (l) => l.email ?? "—" },
    { key: "phone", header: "Phone", render: (l) => l.phone ?? "—" },
    { key: "source", header: "Source", sortable: true, render: (l) => (l.source ? LEAD_SOURCE_LABELS[l.source as keyof typeof LEAD_SOURCE_LABELS] ?? l.source : "—") },
    {
      key: "country", header: "Country",
      render: (l) => countryOptions.find((c) => c.value === l.interestedCountry)?.label ?? "—",
    },
    { key: "intake", header: "Intake", render: (l) => l.preferredIntake ?? "—" },
    { key: "employee", header: "Assigned To", render: (l) => l.employee?.user?.name ?? "—" },
    { key: "status", header: "Status", sortable: true, render: (l) => <StatusBadge status={l.status} /> },
    { key: "createdAt", header: "Created", sortable: true, render: (l) => new Date(l.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
  ];


  return (
    <>
      <PageHeader
        title="Leads"
        description="CRM pipeline from first contact to conversion."
        breadcrumbs={["Admin", "Leads"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Add Lead
          </Button>
        }
      />

      {/* Created-date filter + archived toggle (fed via staticParams) */}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="created-from" className="block text-xs text-muted-foreground">Created from</label>
          <input
            id="created-from" type="date" value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="created-to" className="block text-xs text-muted-foreground">Created to</label>
          <input
            id="created-to" type="date" value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2"
          />
        </div>
        <label className="flex items-center gap-2 pb-2">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        {(createdFrom || createdTo || showArchived) && (
          <Button variant="outline" size="sm" className="mb-1.5" onClick={() => { setCreatedFrom(""); setCreatedTo(""); setShowArchived(false); }}>
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        endpoint="/api/leads"
        columns={columns}
        searchPlaceholder="Search name, email, or phone…"
        staticParams={staticParams}
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          { key: "source", label: "Source", options: sourceOptions },
          { key: "countryId", label: "Country", options: countryOptions },
          { key: "employeeId", label: "Employee", options: employeeOptions },
        ]}
        emptyMessage="No leads match your filters."
        rowActions={[
          { label: "View", onClick: (l) => router.push(`/admin/leads/${l.id}`) },
          { label: "Edit", onClick: (l) => setEditLead(l) },
          { label: "Assign", onClick: (l) => setAssignLead(l) },
          { label: "Status", onClick: (l) => setStatusLead(l) },
          { label: "Note", onClick: (l) => setNoteLead(l) },
          {
            label: "Convert",
            onClick: (l) => {
              if (!l.email) {
                toast({ title: "Cannot convert", description: "Add an email to this lead first.", variant: "error" });
                return;
              }
              setConvertLead(l);
            },
          },
          {
            label: "Archive",
            onClick: (l) => setArchiveLead(l),
          },
        ]}
      />

      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="Add Lead"
        fields={baseFields}
        endpoint="/api/leads" invalidateKey="/api/leads" successMessage="Lead created"
      />

      {editLead && (
        <FormDialog
          key={editLead.id} open={!!editLead} onOpenChange={(v) => !v && setEditLead(null)}
          title={`Edit ${editLead.name}`}
          fields={baseFields}
          endpoint="/api/leads" entityId={editLead.id}
          invalidateKey="/api/leads" successMessage="Lead updated"
        />
      )}

      {assignLead && (
        <FormDialog
          key={`assign-${assignLead.id}`} open={!!assignLead} onOpenChange={(v) => !v && setAssignLead(null)}
          title={`Assign employee — ${assignLead.name}`}
          description="Assign a counselor to own this lead."
          fields={[{ type: "select", name: "assignedEmployeeId", label: "Employee", options: employeeOptions, required: true }]}
          endpoint="/api/leads" entityId={assignLead.id}
          invalidateKey="/api/leads" successMessage="Employee assigned"
        />
      )}

      {statusLead && (
        <FormDialog
          key={`status-${statusLead.id}`} open={!!statusLead} onOpenChange={(v) => !v && setStatusLead(null)}
          title={`Change status — ${statusLead.name}`}
          fields={[{ type: "select", name: "status", label: "New status", options: statusOptions, required: true }]}
          endpoint="/api/leads" entityId={statusLead.id}
          invalidateKey="/api/leads" successMessage="Status updated"
        />
      )}

      {noteLead && (
        <AddNoteDialog key={`note-${noteLead.id}`} leadId={noteLead.id} leadName={noteLead.name} onDone={invalidate} onClose={() => setNoteLead(null)} />
      )}

      <ConfirmDialog
        open={!!convertLead} onOpenChange={(v) => !v && setConvertLead(null)}
        title="Convert to Student"
        message={`Create a student account for ${convertLead?.name}? Their lead history is preserved and linked. Duplicate conversion is blocked server-side.`}
        confirmLabel="Convert"
        onConfirm={async () => {
          try {
            await apiFetch(`/api/leads/${convertLead!.id}/convert`, { method: "POST" });
            toast({ title: "Lead converted", description: `${convertLead!.name} is now a student.`, variant: "success" });
            invalidate();
          } catch (err) {
            toast({ title: "Conversion failed", description: (err as Error).message, variant: "error" });
            throw err;
          }
        }}
      />

      <ConfirmDialog
        open={!!archiveLead} onOpenChange={(v) => !v && setArchiveLead(null)}
        title={archiveLead?.archivedAt ? "Unarchive Lead" : "Archive Lead"}
        message={
          archiveLead?.archivedAt
            ? `Restore ${archiveLead.name} to the active pipeline?`
            : `Archive ${archiveLead?.name}? Archived leads are hidden from the default list and cannot be converted.`
        }
        confirmLabel={archiveLead?.archivedAt ? "Unarchive" : "Archive"}
        destructive={!archiveLead?.archivedAt}
        onConfirm={async () => {
          try {
            await apiFetch(`/api/leads/${archiveLead!.id}`, {
              method: "PATCH",
              json: { archived: !archiveLead!.archivedAt },
            });
            toast({ title: archiveLead!.archivedAt ? "Lead unarchived" : "Lead archived", variant: "success" });
            invalidate();
          } catch (err) {
            toast({ title: "Failed", description: (err as Error).message, variant: "error" });
            throw err;
          }
        }}
      />
    </>
  );
}


function AddNoteDialog({
  leadId,
  leadName,
  onDone,
  onClose,
}: {
  leadId: string;
  leadName: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label={`Add note to ${leadName}`}>
      <div className="w-[95vw] max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <h2 className="text-base font-semibold">Add note — {leadName}</h2>
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Your note…"
          className="mt-3 min-h-[90px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          aria-label="Note text"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!note.trim()) {
                toast({ title: "Note is empty", variant: "error" });
                return;
              }
              setBusy(true);
              try {
                const lead = await apiFetch<{ notes: string | null }>(`/api/leads/${leadId}`);
                const stamp = new Date().toLocaleString("en-GB");
                await apiFetch(`/api/leads/${leadId}`, {
                  method: "PATCH",
                  json: { notes: `${lead.notes ? lead.notes + "\n" : ""}[${stamp}] ${note.trim()}` },
                });
                toast({ title: "Note added", variant: "success" });
                onDone();
                onClose();
              } catch (err) {
                toast({ title: "Failed", description: (err as Error).message, variant: "error" });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>
    </div>
  );
}
