"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Tag,
} from "lucide-react";

type SupportDetail = {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string;
    email: string;
    phone: string | null;
    userId: string;
  };
};

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const PRIORITY_TONE: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  APPLICATION: "Application",
  DOCUMENTS: "Documents",
  UNIVERSITY: "University",
  VISA: "Visa",
  PAYMENTS: "Payments",
  APPOINTMENTS: "Appointments",
  ACCOUNT: "Account",
  OTHER: "Other",
};

export function SupportDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [response, setResponse] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { data, isLoading, error } = useQuery<{ data: SupportDetail }>({
    queryKey: ["/api/support", id],
    queryFn: () => apiFetch<{ data: SupportDetail }>(`/api/support/${id}`),
  });

  const req = data?.data;

  async function respond() {
    if (!response.trim()) {
      toast({ title: "Response is empty", variant: "error" });
      return;
    }
    setActionLoading(true);
    try {
      await apiFetch(`/api/support/${id}/respond`, {
        method: "POST",
        json: { response: response.trim() },
      });
      toast({ title: "Response sent", variant: "success" });
      setResponse("");
      qc.invalidateQueries({ queryKey: ["/api/support"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function resolve() {
    setActionLoading(true);
    try {
      await apiFetch(`/api/support/${id}/resolve`, { method: "POST" });
      toast({ title: "Marked as resolved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/support"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function close() {
    if (!confirm("Close this support request?")) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/support/${id}/close`, { method: "POST" });
      toast({ title: "Request closed" });
      qc.invalidateQueries({ queryKey: ["/api/support"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Link href=".." className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to support
        </Link>
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="space-y-4">
        <Link href=".." className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to support
        </Link>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          {error instanceof Error ? error.message : "Support request not found."}
        </div>
      </div>
    );
  }

  const isClosed = req.status === "RESOLVED" || req.status === "CLOSED";

  return (
    <div className="space-y-4">
      <Link href=".." className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to support
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[req.status]}`}>
                {STATUS_LABELS[req.status]}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_TONE[req.priority]}`}>
                {req.priority}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" />
                {CATEGORY_LABELS[req.category] ?? req.category}
              </span>
            </div>
            <h1 className="mt-2 text-lg font-bold">{req.subject}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Submitted {formatDate(req.createdAt)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {!isClosed && (
          <div className="mt-4 flex gap-2">
            <Button onClick={resolve} disabled={actionLoading} variant="outline" className="flex-1">
              <CheckCircle2 className="h-4 w-4" /> Resolve
            </Button>
            <Button onClick={close} disabled={actionLoading} variant="outline" className="flex-1 text-muted-foreground">
              <XCircle className="h-4 w-4" /> Close
            </Button>
          </div>
        )}
      </div>

      {/* Student + description grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Student info */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-primary" /> Student
          </h2>
          <Link href={`/admin/students/${req.student.id}`} className="block">
            <p className="font-medium hover:text-primary">
              {req.student.firstName} {req.student.lastName}
            </p>
          </Link>
          <p className="text-xs text-muted-foreground">{req.student.studentId}</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {req.student.email}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Description</h2>
          <p className="whitespace-pre-wrap text-sm">{req.description}</p>
          {req.attachmentUrl && (
            <a
              href={req.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              📎 {req.attachmentName ?? "View attachment"}
            </a>
          )}
        </div>
      </div>

      {/* Previous response */}
      {req.response && (
        <div className="rounded-xl border border-border bg-emerald-50/50 p-4 dark:bg-emerald-950/10">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Send className="h-4 w-4 text-emerald-600" /> Previous Response
          </h2>
          <p className="whitespace-pre-wrap text-sm">{req.response}</p>
          {req.respondedAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Responded {formatDate(req.respondedAt)}
            </p>
          )}
        </div>
      )}

      {/* Response form */}
      {!isClosed && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">
            {req.response ? "Send another response" : "Respond to this request"}
          </h2>
          <Textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Type your response here. The student will be notified."
            rows={4}
            disabled={actionLoading}
          />
          <div className="mt-2 flex justify-end">
            <Button onClick={respond} disabled={actionLoading || !response.trim()}>
              <Send className="h-4 w-4" /> Send Response
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" /> Timeline
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Submitted</span>
            <span>{formatDate(req.createdAt)}</span>
          </div>
          {req.respondedAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">First response</span>
              <span>{formatDate(req.respondedAt)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last updated</span>
            <span>{formatDate(req.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
