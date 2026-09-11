"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  History,
  RefreshCw,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import { formatFileSize } from "@/lib/constants/documents";
import { format, parseISO } from "date-fns";

export type DocumentItem = {
  id: string;
  name: string;
  category: string | null;
  status: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  previewable: boolean;
  uploadedAt: Date | string | null;
  reviewedAt: Date | string | null;
  expiresAt: Date | string | null;
  reviewNote: string | null;
  requirement: { id: string; name: string } | null;
  replacesId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const STATUS_TONE: Record<string, "default" | "info" | "warning" | "destructive" | "success"> = {
  REQUESTED: "warning",
  UPLOADED: "info",
  UNDER_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  EXPIRED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  UPLOADED: "Uploaded",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

/**
 * Document card — mobile-first compact card showing all the document
 * metadata + status-appropriate actions.
 *
 * Actions are shown only when allowed for the current status:
 *  - REQUESTED    → Upload (opens the upload sheet with no replaceId)
 *  - UPLOADED     → View, Download
 *  - UNDER_REVIEW → View, Download
 *  - APPROVED     → View, Download, Replace (creates a new version)
 *  - REJECTED     → View, Download, Upload New Version (replace CTA is prominent)
 *  - EXPIRED      → View, Download, Upload New Version
 *
 * If the document has a rejection reason (reviewNote + status=REJECTED),
 * it's shown in a prominent banner with the "Upload New Version" CTA.
 */
export function DocumentCard({
  doc,
  onUpload,
  onReplace,
  onView,
}: {
  doc: DocumentItem;
  onUpload: (doc: DocumentItem) => void;
  onReplace: (doc: DocumentItem) => void;
  onView: (doc: DocumentItem) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const isRejected = doc.status === "REJECTED";
  const isApproved = doc.status === "APPROVED";
  const isRequested = doc.status === "REQUESTED";
  const isExpired = doc.status === "EXPIRED";
  const showReplace = isApproved || isRejected || isExpired;
  const showDownload = !isRequested; // all statuses except REQUESTED have a file

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/student/documents/${doc.id}/download`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Download failed");
      }
      const blob = await res.blob();
      // Trigger a download via an object URL.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke the object URL after a delay so the download has time
      // to start.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      // Use a toast-like inline alert — the parent passes a callback
      // for navigation, but we don't have a toast context here.
      console.error("Download failed", err);
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm transition-colors",
        isRejected ? "border-destructive/40" : isApproved ? "border-success/30" : "border-border",
      )}
    >
      {/* Header: name + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-md",
              doc.previewable ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{doc.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {doc.category ?? "Other"} · {formatFileSize(doc.fileSize)} · {doc.mimeType.split("/")[1]?.toUpperCase() ?? "?"}
            </p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[doc.status] ?? "default"}>
          {STATUS_LABEL[doc.status] ?? doc.status}
        </Badge>
      </div>

      {/* Dates row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {doc.uploadedAt && (
          <span className="inline-flex items-center gap-1">
            <Upload className="h-3 w-3" aria-hidden />
            Uploaded {fmtDate(doc.uploadedAt)}
          </span>
        )}
        {doc.reviewedAt && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Reviewed {fmtDate(doc.reviewedAt)}
          </span>
        )}
        {doc.expiresAt && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden />
            Expires {fmtDate(doc.expiresAt)}
          </span>
        )}
        {doc.replacesId && (
          <span className="inline-flex items-center gap-1">
            <History className="h-3 w-3" aria-hidden />
            Replaced an older version
          </span>
        )}
      </div>

      {/* Rejection banner — only for REJECTED documents */}
      {isRejected && doc.reviewNote && (
        <div className="mt-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-destructive">Rejected</p>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                <span className="text-muted-foreground">Reason:</span> {doc.reviewNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expired banner — only for EXPIRED documents */}
      {isExpired && (
        <div className="mt-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
            <p className="text-foreground">
              This document has expired. Please upload a new version.
            </p>
          </div>
        </div>
      )}

      {/* REQUESTED banner — no file uploaded yet */}
      {isRequested && (
        <div className="mt-2.5 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            <p className="text-foreground">
              This document is awaiting your upload.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {isRequested && (
          <Button size="sm" onClick={() => onUpload(doc)} className="min-h-[40px]">
            <Upload className="h-3.5 w-3.5" aria-hidden /> Upload
          </Button>
        )}
        {doc.previewable && !isRequested && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView(doc)}
            className="min-h-[40px]"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden /> View
          </Button>
        )}
        {showDownload && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
            className="min-h-[40px]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {downloading ? "…" : "Download"}
          </Button>
        )}
        {showReplace && (
          <Button
            size="sm"
            variant={isRejected || isExpired ? "default" : "outline"}
            onClick={() => onReplace(doc)}
            className="min-h-[40px]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {isRejected || isExpired ? "Upload New Version" : "Replace"}
          </Button>
        )}
      </div>
    </div>
  );
}

function fmtDate(d: Date | string): string {
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}
