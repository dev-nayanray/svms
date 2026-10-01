"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui";
import { DocumentReviewDrawer } from "@/components/employee/document-review-drawer";
import type { DocumentRow } from "@/lib/services/document-cases";

export function DocumentRowItem({
  doc,
  canReview,
}: {
  doc: DocumentRow;
  canReview: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <>
      <tr className="hover:bg-muted/30">
        <td className="px-4 py-3">
          <p className="font-medium">{doc.name}</p>
          {doc.fileName && <p className="text-xs text-muted-foreground">{doc.fileName}</p>}
          {doc.version > 1 && (
            <span className="mt-0.5 inline-flex items-center rounded-md border border-info/20 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">
              v{doc.version}
            </span>
          )}
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          {doc.student.firstName} {doc.student.lastName}
          <p className="text-xs text-muted-foreground">{doc.student.studentId}</p>
        </td>
        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{doc.application?.applicationNumber ?? "—"}</td>
        <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">{doc.documentType ?? "—"}</td>
        <td className="px-4 py-3">
          <StatusBadge status={doc.status} />
          {doc.expiresAt && doc.expiresAt < new Date() && doc.status !== "EXPIRED" && (
            <span className="ml-1 inline-flex items-center rounded-md border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              Expired
            </span>
          )}
        </td>
        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{doc.uploadedAt ? formatDate(doc.uploadedAt) : "—"}</td>
        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{doc.expiresAt ? formatDate(doc.expiresAt) : "—"}</td>
        <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">{doc.reviewer?.name ?? "—"}</td>
        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{formatDate(doc.updatedAt)}</td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(true)} aria-label="Review document">
            <Eye className="h-3.5 w-3.5" aria-hidden /> Review
          </Button>
        </td>
      </tr>
      <DocumentReviewDrawer doc={doc} open={drawerOpen} onOpenChange={setDrawerOpen} canReview={canReview} />
    </>
  );
}

import { formatDate, titleCase } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const TONES: Record<string, string> = {
    REQUESTED: "border-warning/20 bg-warning/10 text-warning",
    UPLOADED: "border-info/20 bg-info/10 text-info",
    UNDER_REVIEW: "border-info/20 bg-info/10 text-info",
    APPROVED: "border-success/20 bg-success/10 text-success",
    REJECTED: "border-destructive/20 bg-destructive/10 text-destructive",
    EXPIRED: "border-destructive/20 bg-destructive/10 text-destructive",
  };
  const tone = TONES[status] ?? "border-border bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {titleCase(status)}
    </span>
  );
}
