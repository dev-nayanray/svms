"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  UserRound,
  Video,
  WifiOff,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import {
  MobilePage,
  MobileCard,
  StudentEmptyState,
  StudentErrorState,
  FilterChip,
  StatusBadge,
} from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { RequestAppointmentSheet } from "./request-appointment-sheet";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

// ── Types ──────────────────────────────────────────────────────────

type Appointment = {
  id: string;
  scheduledAt: string;
  durationMins: number;
  purpose: string;
  location: string | null;
  meetingMethod: string | null;
  meetingLink: string | null;
  status: string;
  statusLabel: string;
  notes: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  counselorName: string;
  counselorInitials: string;
  counselorId: string;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { appointments: Appointment[] };

// ── Status → tone ──────────────────────────────────────────────────

const STATUS_TONE: Record<string, "default" | "info" | "warning" | "success" | "destructive"> = {
  REQUESTED: "info",
  SCHEDULED: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "default",
  NO_SHOW: "destructive",
};

type FilterValue = "upcoming" | "past" | "cancelled" | "requested" | "all";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "requested", label: "Requested" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

// ── Component ──────────────────────────────────────────────────────

export function AppointmentsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("upcoming");
  const [requestOpen, setRequestOpen] = useState(false);
  const [sheetInstance, setSheetInstance] = useState(0);
  const online = useOnlineStatus();

  const listQ = useQuery<ListResponse>({
    queryKey: ["student-appointments", filter],
    queryFn: () => apiFetch<ListResponse>(`/api/student/appointments?filter=${filter}`),
    retry: false,
    // Real-time updates arrive via SSE (StudentRealtimeProvider).
    // 120s fallback polling in case SSE has a prolonged disconnect.
    refetchInterval: 120_000,
    staleTime: 30_000,
  });

  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <AppointmentsSkeleton />
      </MobilePage>
    );
  }

  if (listQ.isError && !listQ.data) {
    return (
      <MobilePage>
        <StudentErrorState
          online={online}
          title={!online ? "You're offline" : "Couldn't load your appointments"}
          description={!online ? "Check your connection and try again." : "Please try again in a moment."}
          onRetry={() => listQ.refetch()}
        />
      </MobilePage>
    );
  }

  const appointments = listQ.data?.appointments ?? [];
  const upcoming = appointments.filter((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED");
  const heroAppt = upcoming[0] ?? null;

  async function handleConfirm(appt: Appointment) {
    qc.setQueryData<ListResponse>(["student-appointments", filter], (prev) =>
      prev
        ? {
            appointments: prev.appointments.map((a) =>
              a.id === appt.id ? { ...a, status: "CONFIRMED", statusLabel: "Confirmed" } : a,
            ),
          }
        : prev,
    );
    try {
      await apiFetch(`/api/student/appointments/${appt.id}/confirm`, { method: "POST" });
      toast({ title: "Appointment confirmed", variant: "success" });
      qc.invalidateQueries({ queryKey: ["student-appointments"] });
    } catch (err) {
      qc.invalidateQueries({ queryKey: ["student-appointments"] });
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Try again", variant: "error" });
    }
  }

  async function handleCancel(appt: Appointment) {
    const isRequest = appt.status === "REQUESTED";
    const msg = isRequest
      ? "Cancel this appointment request? Your counselor will be notified."
      : "Cancel this appointment? Your counselor will be notified.";
    if (!confirm(msg)) return;
    qc.setQueryData<ListResponse>(["student-appointments", filter], (prev) =>
      prev
        ? {
            appointments: prev.appointments.filter((a) => a.id !== appt.id),
          }
        : prev,
    );
    try {
      await apiFetch(`/api/student/appointments/${appt.id}/cancel`, {
        method: "POST",
        json: { cancelReason: isRequest ? "Request withdrawn by student" : "Cancelled by student" },
      });
      toast({ title: isRequest ? "Request withdrawn" : "Appointment cancelled" });
      qc.invalidateQueries({ queryKey: ["student-appointments"] });
    } catch (err) {
      qc.invalidateQueries({ queryKey: ["student-appointments"] });
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Try again", variant: "error" });
    }
  }

  function openRequestSheet() {
    // Bump the key so the sheet remounts with fresh state.
    setSheetInstance((n) => n + 1);
    setRequestOpen(true);
  }

  function handleRequested() {
    qc.invalidateQueries({ queryKey: ["student-appointments"] });
    setFilter("requested");
  }

  return (
    <MobilePage>
      {/* Primary CTA — Request appointment */}
      <Button onClick={openRequestSheet} className="w-full" size="lg">
        <Plus className="h-4 w-4" aria-hidden />
        Request appointment
      </Button>

      <RequestAppointmentSheet
        key={sheetInstance}
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onRequested={handleRequested}
      />

      {/* Upcoming hero card */}
      {heroAppt && filter === "upcoming" && (
        <AppointmentHero appointment={heroAppt} onConfirm={() => handleConfirm(heroAppt)} onCancel={() => handleCancel(heroAppt)} />
      )}

      {/* Filter tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1.5">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.value}
              active={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Appointment list */}
      {appointments.length === 0 ? (
        <StudentEmptyState
          icon={
            filter === "requested"
              ? <Clock3 className="h-5 w-5" aria-hidden />
              : <CalendarClock className="h-5 w-5" aria-hidden />
          }
          title={
            filter === "upcoming" ? "No upcoming appointments"
            : filter === "requested" ? "No pending requests"
            : filter === "past" ? "No past appointments"
            : filter === "cancelled" ? "No cancelled appointments"
            : "No appointments yet"
          }
          description={
            filter === "requested"
              ? "Tap \u201cRequest appointment\u201d above to propose a time with your counselor."
              : "Your counselor will schedule appointments as your application progresses."
          }
        />
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              onConfirm={() => handleConfirm(a)}
              onCancel={() => handleCancel(a)}
            />
          ))}
        </div>
      )}

      {/* CTA row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link href="/student/messages" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500">
          Message Counselor
        </Link>
        <Link href="/student/application" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500">
          My Application
        </Link>
        <Link href="/student/tasks" className="col-span-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-500 sm:col-span-1">
          My Tasks
        </Link>
      </div>

      {/* Refresh + offline */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Auto-refreshes every 60s"}</span>
        {!online && <span className="flex items-center gap-1 text-amber-600"><WifiOff className="h-3 w-3" aria-hidden /> Offline</span>}
        <Button size="sm" variant="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching} aria-label="Refresh list">
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── Hero card (next upcoming appointment) ─────────────────────────

function AppointmentHero({
  appointment,
  onConfirm,
  onCancel,
}: {
  appointment: Appointment;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const date = parseISO(appointment.scheduledAt);
  const tone = STATUS_TONE[appointment.status] ?? "default";

  return (
    <MobileCard className={cn(
      "space-y-3 border-2",
      tone === "warning" && "border-warning/40",
      tone === "info" && "border-info/40",
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Next Appointment
        </p>
        <StatusBadge tone={tone}>{appointment.statusLabel}</StatusBadge>
      </div>

      <div className="flex items-center gap-3">
        {/* Date block */}
        <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-center text-primary">
          <p className="text-[10px] font-medium uppercase">{format(date, "EEE")}</p>
          <p className="text-2xl font-bold leading-none">{format(date, "d")}</p>
          <p className="text-[10px] font-medium uppercase">{format(date, "MMM")}</p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{appointment.purpose}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(date, "h:mm a")} · {appointment.durationMins}min
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="h-3 w-3" aria-hidden />
            {appointment.counselorName}
          </p>
          {appointment.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden />
              {appointment.location}
            </p>
          )}
        </div>
      </div>

      {appointment.status === "SCHEDULED" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm} className="flex-1">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Confirm
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="flex-1 text-destructive hover:bg-destructive/10">
            <XCircle className="h-3.5 w-3.5" aria-hidden /> Cancel
          </Button>
        </div>
      )}
    </MobileCard>
  );
}

// ── Appointment card ───────────────────────────────────────────────

function AppointmentCard({
  appointment,
  onConfirm,
  onCancel,
}: {
  appointment: Appointment;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const date = parseISO(appointment.scheduledAt);
  const tone = STATUS_TONE[appointment.status] ?? "default";
  const isUpcoming = appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED";
  const isRequested = appointment.status === "REQUESTED";
  const meetingIcon = appointment.meetingMethod === "VIDEO_CALL" || appointment.meetingMethod === "ONLINE"
    ? <Video className="h-3 w-3" aria-hidden />
    : <MapPin className="h-3 w-3" aria-hidden />;

  return (
    <MobileCard className={cn(
      "space-y-2",
      tone === "success" && "border-success/30",
      tone === "destructive" && "border-destructive/30",
      tone === "default" && "opacity-70",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {/* Mini date block */}
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-center text-primary">
            <p className="text-[9px] font-medium uppercase leading-none">{format(date, "EEE")}</p>
            <p className="text-base font-bold leading-none">{format(date, "d")}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{appointment.purpose}</p>
            <p className="text-xs text-muted-foreground">
              {format(date, "MMM d, h:mm a")} · {appointment.durationMins}min
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserRound className="h-3 w-3" aria-hidden />
              {appointment.counselorName}
            </div>
            {(appointment.location || appointment.meetingMethod) && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                {meetingIcon}
                {appointment.location || appointment.meetingMethod}
              </p>
            )}
            {appointment.cancelReason && (
              <p className="mt-1 rounded bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
                Cancelled: {appointment.cancelReason}
              </p>
            )}
          </div>
        </div>
        <StatusBadge tone={tone}>{appointment.statusLabel}</StatusBadge>
      </div>

      {isUpcoming && appointment.status === "SCHEDULED" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm} className="flex-1">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Confirm
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="flex-1 text-destructive hover:bg-destructive/10">
            <XCircle className="h-3.5 w-3.5" aria-hidden /> Cancel
          </Button>
        </div>
      )}
      {isRequested && (
        <div className="flex items-center gap-2 rounded-lg bg-info/5 border border-info/20 px-3 py-2">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
          <p className="min-w-0 flex-1 text-xs text-info">
            Pending counselor approval. You can withdraw this request before they respond.
          </p>
          <Button size="sm" variant="outline" onClick={onCancel} className="shrink-0 text-destructive hover:bg-destructive/10">
            <XCircle className="h-3.5 w-3.5" aria-hidden /> Withdraw
          </Button>
        </div>
      )}
    </MobileCard>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function AppointmentsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading appointments">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-8 w-full rounded-full" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

