"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, RotateCcw, Download } from "lucide-react";
import { Button, Textarea, Label, Badge, Separator } from "@/components/ui";
import { Drawer } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { formatDate, titleCase } from "@/lib/utils";

type DocumentDetail = {
  id: string;
  name: string;
  documentType: string | null;
  status: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  reviewNote: string | null;
  fileUrl: string | null;
  uploadedAt: Date | null;
  reviewedAt: Date | null;
  expiresAt: Date | null;
  version: number;
  previousVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  application: { id: string; applicationNumber: string } | null;
  reviewer: { id: string; name: string } | null;
};

export function DocumentReviewDrawer({
  doc,
  open,
  onOpenChange,
  canReview,
}: {
  doc: DocumentDetail;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canReview: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [reviewNote, setReviewNote] = useState("");
  const [reuploadReason, setReuploadReason] = useState("");
  const [saving, setSaving] = useState<"approve" | "reject" | "reupload" | null>(null);

  const submitReview = async (decision: "APPROVED" | "REJECTED") => {
    if (decision === "REJECTED" && !reviewNote.trim()) {
      toast({ title: "Rejection reason required", description: "You must provide a reason when rejecting a document.", variant: "error" });
      return;
    }
    setSaving(decision === "APPROVED" ? "approve" : "reject");
    try {
      const res = await fetch(`/api/employee/documents/${doc.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNote: reviewNote.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({ title: `Document ${decision.toLowerCase()}`, variant: "success" });
      setReviewNote("");
      router.refresh();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Review failed", description: err instanceof Error ? err.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(null);
    }
  };

  const submitReupload = async () => {
    if (!reuploadReason.trim()) {
      toast({ title: "Reason required", description: "You must provide a reason for the re-upload request.", variant: "error" });
      return;
    }
    setSaving("reupload");
    try {
      const res = await fetch(`/api/employee/documents/${doc.id}/reupload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reuploadReason.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      }
      toast({ title: "Re-upload requested", variant: "success" });
      setReuploadReason("");
      router.refresh();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Request failed", description: err instanceof Error ? err.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(null);
    }
  };

  const STATUS_TONE: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
    REQUESTED: "warning", UPLOADED: "info", UNDER_REVIEW: "info",
    APPROVED: "success", REJECTED: "destructive", EXPIRED: "destructive",
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={`Review: ${doc.name}`}>
      <div className="space-y-4">
        {/* Status + metadata */}
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[doc.status] ?? "default"}>{titleCase(doc.status)}</Badge>
          {doc.version > 1 && <Badge tone="info">v{doc.version}</Badge>}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-xs">
          <Meta label="Student" value={`${doc.student.firstName} ${doc.student.lastName}`} />
          <Meta label="Student ID" value={doc.student.studentId} />
          {doc.application && <Meta label="Application" value={doc.application.applicationNumber} />}
          {doc.documentType && <Meta label="Type" value={doc.documentType} />}
          <Meta label="File" value={doc.fileName ?? "—"} />
          <Meta label="Size" value={doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : "—"} />
          <Meta label="MIME" value={doc.mimeType ?? "—"} />
          <Meta label="Version" value={String(doc.version)} />
          <Meta label="Uploaded" value={doc.uploadedAt ? formatDate(doc.uploadedAt) : "—"} />
          <Meta label="Reviewed" value={doc.reviewedAt ? formatDate(doc.reviewedAt) : "—"} />
          {doc.expiresAt && <Meta label="Expires" value={formatDate(doc.expiresAt)} />}
          {doc.reviewer && <Meta label="Reviewer" value={doc.reviewer.name} />}
        </dl>

        {doc.reviewNote && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <p className="font-semibold text-muted-foreground">Review note</p>
            <p className="mt-1">{doc.reviewNote}</p>
          </div>
        )}

        {/* File preview / download */}
        {doc.fileUrl && doc.mimeType && (
          <Separator />
        )}
        {doc.fileUrl && doc.mimeType?.startsWith("image/") && (
          <div>
            <Label className="text-xs">Preview</Label>
            <img src={doc.fileUrl} alt={doc.name ?? "Document"} className="mt-2 max-h-64 rounded-md border border-border" />
          </div>
        )}
        {doc.fileUrl && doc.mimeType === "application/pdf" && (
          <div>
            <Label className="text-xs">Preview</Label>
            <object data={doc.fileUrl} type="application/pdf" className="mt-2 h-64 w-full rounded-md border border-border">
              <p className="p-4 text-xs text-muted-foreground">PDF preview not available. Use download below.</p>
            </object>
          </div>
        )}
        {doc.fileUrl && (
          <a href={`/api/employee/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" aria-hidden /> Download</Button>
          </a>
        )}

        {/* Approved-doc warning */}
        {doc.status === "APPROVED" && (
          <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-xs text-success">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>This document is approved. Replacing it creates a new version — the approved version is preserved.</span>
          </div>
        )}

        {/* Review actions */}
        {canReview && doc.status !== "APPROVED" && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs">Review note {doc.status !== "APPROVED" ? "(required for rejection)" : ""}</Label>
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                placeholder="Reason for rejection or review notes…"
                disabled={saving !== null}
                maxLength={2000}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => submitReview("APPROVED")} disabled={saving !== null} size="sm">
                {saving === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                Approve
              </Button>
              <Button onClick={() => submitReview("REJECTED")} disabled={saving !== null || !reviewNote.trim()} variant="destructive" size="sm">
                {saving === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
                Reject
              </Button>
            </div>
          </>
        )}

        {/* Re-upload request */}
        {canReview && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs">Request re-upload</Label>
              <Textarea
                value={reuploadReason}
                onChange={(e) => setReuploadReason(e.target.value)}
                rows={2}
                placeholder="Reason the student needs to re-upload…"
                disabled={saving !== null}
                maxLength={2000}
              />
              <Button onClick={submitReupload} disabled={saving !== null || !reuploadReason.trim()} variant="outline" size="sm">
                {saving === "reupload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                Request re-upload
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
