"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  MapPin,
  RefreshCw,
  UserRound,
  Video,
  WifiOff,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

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
  SCHEDULED: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "default",
  NO_SHOW: "destructive",
};

const FILTERS: { value: "upcoming" | "past" | "cancelled" | "all"; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

// ── Component ──────────────────────────────────────────────────────

export function AppointmentsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"upcoming" | "past" | "cancelled" | "all">("upcoming");
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
        <MobileCard className="py-8 text-center">
          {!online ? (
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          ) : (
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          )}
          <h2 className="mt-3 text-base font-semibold">
            {!online ? "You're offline" : "Couldn't load your appointments"}
          </h2>
          <Button onClick={() => listQ.refetch()} className="mt-4" disabled={!online}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
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
    if (!confirm("Cancel this appointment? Your counselor will be notified.")) return;
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
        json: { cancelReason: "Cancelled by student" },
      });
      toast({ title: "Appointment cancelled" });
      qc.invalidateQueries({ queryKey: ["student-appointments"] });
    } catch (err) {
      qc.invalidateQueries({ queryKey: ["student-appointments"] });
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Try again", variant: "error" });
    }
  }

  return (
    <MobilePage>
      {/* Upcoming hero card */}
      {heroAppt && filter === "upcoming" && (
        <AppointmentHero appointment={heroAppt} onConfirm={() => handleConfirm(heroAppt)} onCancel={() => handleCancel(heroAppt)} />
      )}

      {/* Filter tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment list */}
      {appointments.length === 0 ? (
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">
            {filter === "upcoming" && "No upcoming appointments"}
            {filter === "past" && "No past appointments"}
            {filter === "cancelled" && "No cancelled appointments"}
            {filter === "all" && "No appointments yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Your counselor will schedule appointments as your application progresses.
          </p>
        </MobileCard>
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
        <Link href="/student/messages" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted">
          Message Counselor
        </Link>
        <Link href="/student/application" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted">
          My Application
        </Link>
        <Link href="/student/tasks" className="col-span-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted sm:col-span-1">
          My Tasks
        </Link>
      </div>

      {/* Refresh + offline */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Auto-refreshes every 60s"}</span>
        {!online && <span className="flex items-center gap-1 text-warning"><WifiOff className="h-3 w-3" aria-hidden /> Offline</span>}
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
        <Badge tone={tone}>{appointment.statusLabel}</Badge>
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
        <Badge tone={tone}>{appointment.statusLabel}</Badge>
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

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
