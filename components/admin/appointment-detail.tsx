"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  XCircle,
  MapPin,
  Video,
  Phone,
  Clock,
  User,
  Mail,
  CheckCircle2,
} from "lucide-react";

type AppointmentDetail = {
  id: string;
  scheduledAt: string;
  durationMins: number;
  purpose: string;
  location: string | null;
  meetingMethod: string | null;
  meetingLink: string | null;
  status: string;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string;
    email: string;
    phone: string | null;
  };
  employee: { id: string; user: { id: string; name: string; email: string } } | null;
};

const STATUS_TONE: Record<string, string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-muted text-muted-foreground",
  NO_SHOW: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function AppointmentDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);

  const { data, isLoading, error } = useQuery<{ data: AppointmentDetail }>({
    queryKey: ["/api/appointments", id],
    queryFn: () => apiFetch<{ data: AppointmentDetail }>(`/api/appointments/${id}`),
  });

  const appt = data?.data;

  async function approve() {
    setActionLoading(true);
    try {
      await apiFetch(`/api/appointments/${id}/approve`, { method: "POST", json: {} });
      toast({ title: "Appointment approved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function reject() {
    if (!confirm("Reject this appointment request?")) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/appointments/${id}/reject`, { method: "POST", json: {} });
      toast({ title: "Request rejected" });
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function markComplete() {
    setActionLoading(true);
    try {
      await apiFetch(`/api/appointments/${id}`, { method: "PATCH", json: { status: "COMPLETED" } });
      toast({ title: "Marked as completed", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function cancel() {
    if (!confirm("Cancel this appointment?")) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/appointments/${id}`, { method: "PATCH", json: { status: "CANCELLED", cancelReason: "Cancelled by admin" } });
      toast({ title: "Appointment cancelled" });
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Link href="/admin/appointments" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to appointments
        </Link>
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error || !appt) {
    return (
      <div className="space-y-4">
        <Link href="/admin/appointments" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to appointments
        </Link>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          {error instanceof Error ? error.message : "Appointment not found."}
        </div>
      </div>
    );
  }

  const MeetingIcon = appt.meetingMethod === "VIDEO_CALL" ? Video : appt.meetingMethod === "PHONE_CALL" ? Phone : MapPin;

  return (
    <div className="space-y-4">
      <Link href="/admin/appointments" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to appointments
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[appt.status] ?? "bg-muted"}`}>
                {STATUS_LABELS[appt.status] ?? appt.status}
              </span>
              {appt.meetingMethod && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MeetingIcon className="h-3 w-3" />
                  {appt.meetingMethod === "VIDEO_CALL" ? "Video call" : appt.meetingMethod === "PHONE_CALL" ? "Phone call" : "In-person"}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-lg font-bold">{appt.purpose}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {formatDate(appt.scheduledAt)} · {appt.durationMins} min
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {appt.status === "REQUESTED" && (
          <div className="mt-4 flex gap-2">
            <Button onClick={approve} disabled={actionLoading} className="flex-1">
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button onClick={reject} disabled={actionLoading} variant="outline" className="flex-1 text-red-600 hover:bg-red-50">
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        )}
        {(appt.status === "SCHEDULED" || appt.status === "CONFIRMED") && (
          <div className="mt-4 flex gap-2">
            <Button onClick={markComplete} disabled={actionLoading} variant="outline" className="flex-1">
              <CheckCircle2 className="h-4 w-4" /> Mark Complete
            </Button>
            <Button onClick={cancel} disabled={actionLoading} variant="outline" className="flex-1 text-red-600 hover:bg-red-50">
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Student info */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-primary" /> Student
          </h2>
          <Link href={`/admin/students/${appt.student.id}`} className="block">
            <p className="font-medium hover:text-primary">
              {appt.student.firstName} {appt.student.lastName}
            </p>
          </Link>
          <p className="text-xs text-muted-foreground">{appt.student.studentId}</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {appt.student.email}
            </p>
            {appt.student.phone && (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> {appt.student.phone}
              </p>
            )}
          </div>
        </div>

        {/* Meeting details */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" /> Meeting Details
          </h2>
          {appt.location && (
            <p className="text-sm">
              <span className="text-muted-foreground">Location:</span> {appt.location}
            </p>
          )}
          {appt.meetingLink && (
            <a
              href={appt.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Video className="h-3 w-3" /> Join meeting
            </a>
          )}
          {!appt.location && !appt.meetingLink && (
            <p className="text-sm text-muted-foreground">No location or meeting link set.</p>
          )}
          {appt.notes && (
            <div className="mt-3 border-t border-border pt-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm">{appt.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" /> Timeline
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{formatDate(appt.createdAt)}</span>
          </div>
          {appt.completedAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span>{formatDate(appt.completedAt)}</span>
            </div>
          )}
          {appt.cancelledAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cancelled</span>
              <span>{formatDate(appt.cancelledAt)}</span>
            </div>
          )}
          {appt.cancelReason && (
            <div className="mt-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
              <span className="font-medium">Cancel reason:</span> {appt.cancelReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
