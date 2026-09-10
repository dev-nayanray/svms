"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column, type RowAction } from "@/components/shared/data-table";
import { ConfirmDialog, PageHeader } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button, Label, Textarea } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { FileText } from "lucide-react";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABELS,
  formatFileSize,
  isReviewable,
  canReject,
  canRequestReupload,
} from "@/lib/constants/documents";
import { formatDate } from "@/lib/utils";

type Country = { id: string; name: string; flag: string | null };
type Student = { id: string; firstName: string; lastName: string; studentId: string };
type Application = { id: string; applicationNumber: string };
type Employee = { id: string; user: { name: string } };

type Document = {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  reviewNote: string | null;
  uploadedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string;
  };
  application: {
    id: string;
    applicationNumber: string;
    country: Country;
  } | null;
  requirement: { id: string; name: string } | null;
};

type Meta = {
  countries: Country[];
  students: Student[];
  applications: Application[];
  employees: Employee[];
};

const statusOptions = DOCUMENT_STATUSES.map((s) => ({
  value: s,
  label: DOCUMENT_STATUS_LABELS[s],
}));

/**
 * Admin Documents list — full review workflow via reusable components:
 *  - server-side search (document name, file name, student name)
 *  - filters: Status, Country, Application, Student, Employee
 *  - date range (uploadedFrom / uploadedTo) via staticParams
 *  - archived toggle to view soft-deleted documents
 *  - row actions: Approve, Reject, Re-upload, Archive
 *
 * Review rules enforced server-side:
 *  - Only REVIEWABLE statuses (UPLOADED, UNDER_REVIEW, REJECTED) can be
 *    approved/rejected. APPROVED docs must first be revoked via re-upload.
 *  - Rejection REQUIRES a reason (enforced by Zod schema).
 *  - Re-upload request REQUIRES a reason.
 *  - Approved documents cannot be silently replaced.
 *
 * Private documents: the fileUrl is never exposed in the API response.
 * File serving goes through a secure endpoint (TODO — file storage is
 * currently a URL stored in the DB; production should use signed URLs).
 */
export function DocumentsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/documents"] });

  const [showArchived, setShowArchived] = useState(false);
  const [uploadedFrom, setUploadedFrom] = useState("");
  const [uploadedTo, setUploadedTo] = useState("");

  const [reviewDoc, setReviewDoc] = useState<Document | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED" | "UNDER_REVIEW">("APPROVED");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  const [reuploadDoc, setReuploadDoc] = useState<Document | null>(null);
  const [reuploadReason, setReuploadReason] = useState("");
  const [reuploadBusy, setReuploadBusy] = useState(false);

  const [archiveDoc, setArchiveDoc] = useState<Document | null>(null);

  // Pull filter metadata (countries, students, applications, employees)
  const { data: meta } = useQuery({
    queryKey: ["/api/documents/meta"],
    queryFn: () => apiFetch<Meta>("/api/documents/meta"),
    staleTime: 5 * 60_000,
  });

  const countryOptions = (meta?.countries ?? []).map((c) => ({
    value: c.id,
    label: `${c.flag ? `${c.flag} ` : ""}${c.name}`,
  }));
  const studentOptions = (meta?.students ?? []).map((s) => ({
    value: s.id,
    label: `${s.firstName} ${s.lastName} (${s.studentId})`,
  }));
  const applicationOptions = (meta?.applications ?? []).map((a) => ({
    value: a.id,
    label: a.applicationNumber,
  }));
  const employeeOptions = (meta?.employees ?? []).map((e) => ({
    value: e.id,
    label: e.user.name,
  }));

  // Build staticParams from the non-DataTable-managed filters
  const staticParams = useMemo(() => {
    const p: Record<string, string> = { archived: showArchived ? "true" : "false" };
    if (uploadedFrom) p.uploadedFrom = uploadedFrom;
    if (uploadedTo) p.uploadedTo = uploadedTo;
    return p;
  }, [showArchived, uploadedFrom, uploadedTo]);

  const clearDateFilters = () => {
    setUploadedFrom("");
    setUploadedTo("");
    setShowArchived(false);
  };

  const hasExtraFilters = showArchived || uploadedFrom || uploadedTo;

  const openReview = (doc: Document, decision: "APPROVED" | "REJECTED" | "UNDER_REVIEW") => {
    // Client-side pre-flight: check if the action is valid for this status
    if (!isReviewable(doc.status)) {
      toast({
        title: "Cannot review",
        description: `Documents in ${doc.status} status cannot be reviewed. ${
          doc.status === "APPROVED" ? "Request re-upload to revoke first." : ""
        }`,
        variant: "error",
      });
      return;
    }
    if (decision === "REJECTED" && !canReject(doc.status)) {
      toast({
        title: "Cannot reject",
        description: "Approved documents must first be revoked via Request Re-upload.",
        variant: "error",
      });
      return;
    }
    setReviewDoc(doc);
    setReviewDecision(decision);
    setReviewNote("");
  };

  const openReupload = (doc: Document) => {
    if (!canRequestReupload(doc.status)) {
      toast({
        title: "Cannot request re-upload",
        description: `Documents in ${doc.status} status cannot be re-requested.`,
        variant: "error",
      });
      return;
    }
    setReuploadDoc(doc);
    setReuploadReason("");
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewDoc) return;
    if (reviewDecision === "REJECTED" && !reviewNote.trim()) {
      toast({ title: "Rejection reason required", variant: "error" });
      return;
    }
    setReviewBusy(true);
    try {
      await apiFetch(`/api/documents/${reviewDoc.id}/review`, {
        method: "PATCH",
        json: {
          decision: reviewDecision,
          reviewNote: reviewNote.trim() || undefined,
        },
      });
      toast({
        title: `Document ${reviewDecision.toLowerCase().replace("_", " ")}`,
        variant: "success",
      });
      setReviewDoc(null);
      invalidate();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setReviewBusy(false);
    }
  };

  const submitReupload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reuploadDoc) return;
    if (!reuploadReason.trim()) {
      toast({ title: "Reason required", variant: "error" });
      return;
    }
    setReuploadBusy(true);
    try {
      await apiFetch(`/api/documents/${reuploadDoc.id}/reupload`, {
        method: "POST",
        json: { reason: reuploadReason.trim() },
      });
      toast({
        title: "Re-upload requested",
        description: `Student notified to re-upload "${reuploadDoc.name}".`,
        variant: "success",
      });
      setReuploadDoc(null);
      invalidate();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setReuploadBusy(false);
    }
  };

  const columns: Column<Document>[] = [
    {
      key: "name",
      header: "Document",
      sortable: true,
      render: (d) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="truncate font-medium">{d.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {d.fileName} · {formatFileSize(d.fileSize)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "student",
      header: "Student",
      render: (d) => (
        <div>
          <p className="font-medium">
            {d.student.firstName} {d.student.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{d.student.studentId}</p>
        </div>
      ),
    },
    {
      key: "application",
      header: "Application",
      render: (d) =>
        d.application ? (
          <div>
            <p className="font-mono text-xs">{d.application.applicationNumber}</p>
            {d.application.country.flag && (
              <p className="text-xs text-muted-foreground">
                {d.application.country.flag} {d.application.country.name}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: "uploadedAt",
      header: "Uploaded",
      sortable: true,
      render: (d) => (d.uploadedAt ? formatDate(d.uploadedAt) : "—"),
    },
    {
      key: "reviewedAt",
      header: "Reviewed",
      sortable: true,
      render: (d) => (d.reviewedAt ? formatDate(d.reviewedAt) : "—"),
    },
    {
      key: "expiresAt",
      header: "Expires",
      sortable: true,
      render: (d) => {
        if (!d.expiresAt) return "—";
        const exp = new Date(d.expiresAt);
        const isPast = exp.getTime() < Date.now();
        return (
          <span className={isPast ? "text-destructive" : ""}>
            {formatDate(d.expiresAt)}
          </span>
        );
      },
    },
  ];

  // Row actions — all four are always visible. The handlers check the
  // document status client-side and show a toast if the action isn't
  // valid. The server also enforces these rules server-side (409).
  const rowActions: RowAction<Document>[] = [
    {
      label: "Approve",
      onClick: (d) => openReview(d, "APPROVED"),
    },
    {
      label: "Reject",
      onClick: (d) => openReview(d, "REJECTED"),
      destructive: true,
    },
    {
      label: "Re-upload",
      onClick: (d) => openReupload(d),
    },
    {
      label: "Archive",
      onClick: (d) => setArchiveDoc(d),
      destructive: true,
    },
  ];

  return (
    <>
      <PageHeader
        title="Documents"
        description="Review student documents — approve, reject with reason, or request re-upload. Private documents are never publicly accessible."
        breadcrumbs={["Admin", "Documents"]}
      />

      {/* Date range filter + archived toggle (fed via staticParams) */}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="uploaded-from" className="block text-xs text-muted-foreground">
            Uploaded from
          </label>
          <input
            id="uploaded-from"
            type="date"
            value={uploadedFrom}
            onChange={(e) => setUploadedFrom(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="uploaded-to" className="block text-xs text-muted-foreground">
            Uploaded to
          </label>
          <input
            id="uploaded-to"
            type="date"
            value={uploadedTo}
            onChange={(e) => setUploadedTo(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
        {hasExtraFilters && (
          <Button variant="outline" size="sm" className="mb-1.5" onClick={clearDateFilters}>
            Clear
          </Button>
        )}
      </div>

      <DataTable
        endpoint="/api/documents"
        columns={columns}
        searchPlaceholder="Search by document name, file, or student…"
        staticParams={staticParams}
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          { key: "countryId", label: "Country", options: countryOptions },
          { key: "applicationId", label: "Application", options: applicationOptions },
          { key: "studentId", label: "Student", options: studentOptions },
          { key: "employeeId", label: "Employee", options: employeeOptions },
        ]}
        emptyMessage="No documents match your filters."
        rowActions={rowActions}
      />

      {/* Review dialog */}
      {reviewDoc && (
        <Dialog open onOpenChange={(v) => !v && setReviewDoc(null)}>
          <DialogContent
            title={`${
              reviewDecision === "APPROVED"
                ? "Approve"
                : reviewDecision === "REJECTED"
                  ? "Reject"
                  : "Mark Under Review"
            } — ${reviewDoc.name}`}
            description={`Student: ${reviewDoc.student.firstName} ${reviewDoc.student.lastName}`}
            className="max-w-md"
          >
            <form onSubmit={submitReview} className="space-y-3">
              {reviewDecision === "REJECTED" && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Rejection requires a reason. The student will be notified with your note.
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="review-note">
                  {reviewDecision === "REJECTED"
                    ? "Rejection reason *"
                    : reviewDecision === "APPROVED"
                      ? "Approval note (optional)"
                      : "Review note (optional)"}
                </Label>
                <Textarea
                  id="review-note"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    reviewDecision === "REJECTED"
                      ? "e.g. Document is blurry — please re-upload a clear scan."
                      : "Optional note for the student…"
                  }
                  required={reviewDecision === "REJECTED"}
                  maxLength={2000}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewDoc(null)}
                  disabled={reviewBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    reviewBusy || (reviewDecision === "REJECTED" && !reviewNote.trim())
                  }
                  variant={reviewDecision === "REJECTED" ? "destructive" : "default"}
                >
                  {reviewBusy
                    ? "Processing…"
                    : reviewDecision === "APPROVED"
                      ? "Approve"
                      : reviewDecision === "REJECTED"
                        ? "Reject"
                        : "Mark Under Review"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Re-upload request dialog */}
      {reuploadDoc && (
        <Dialog open onOpenChange={(v) => !v && setReuploadDoc(null)}>
          <DialogContent
            title={`Request Re-upload — ${reuploadDoc.name}`}
            description={`Student: ${reuploadDoc.student.firstName} ${reuploadDoc.student.lastName}`}
            className="max-w-md"
          >
            <form onSubmit={submitReupload} className="space-y-3">
              {reuploadDoc.status === "APPROVED" && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  This will revoke the current approval and reset the document to REQUESTED.
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="reupload-reason">
                  Reason for re-upload <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reupload-reason"
                  value={reuploadReason}
                  onChange={(e) => setReuploadReason(e.target.value)}
                  placeholder="e.g. The passport has expired — please upload a renewed copy."
                  required
                  maxLength={2000}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReuploadDoc(null)}
                  disabled={reuploadBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={reuploadBusy || !reuploadReason.trim()}>
                  {reuploadBusy ? "Sending…" : "Request Re-upload"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        open={!!archiveDoc}
        onOpenChange={(v) => !v && setArchiveDoc(null)}
        title={archiveDoc?.deletedAt ? "Unarchive Document" : "Archive Document"}
        message={
          archiveDoc?.deletedAt
            ? `Restore "${archiveDoc?.name}" to the active list?`
            : `Archive "${archiveDoc?.name}"? Archived documents are hidden from the default list but retain their data for audit trails.`
        }
        confirmLabel={archiveDoc?.deletedAt ? "Unarchive" : "Archive"}
        destructive={!archiveDoc?.deletedAt}
        onConfirm={async () => {
          if (!archiveDoc) return;
          try {
            await apiFetch(`/api/documents/${archiveDoc.id}`, {
              method: "PATCH",
              json: { archived: !archiveDoc.deletedAt },
            });
            toast({
              title: archiveDoc.deletedAt ? "Document unarchived" : "Document archived",
              variant: "success",
            });
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
