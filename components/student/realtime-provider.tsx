"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * StudentRealtimeProvider — opens a long-lived SSE connection to
 * /api/student/events and dispatches incoming events to:
 *  - TanStack Query invalidation (instant refetch of affected queries)
 *  - Toast notifications for important events
 *  - A connection-status context (consumed by the header "Live" dot)
 *
 * This replaces the previous polling pattern (5s/30s/60s intervals)
 * with true real-time push. Events arrive in milliseconds.
 *
 * RECONNECTION
 * ============
 * EventSource auto-reconnects on disconnect with the browser's built-in
 * backoff. We additionally track connection state so the header can
 * show "Live" (green) or "Reconnecting…" (amber) to the user.
 *
 * EVENT TYPES
 * ===========
 *  - message_received: invalidate messages + chat queries, toast
 *  - notification_created: invalidate notifications + unread count, toast
 *  - appointment_updated: invalidate appointments, toast
 *  - document_reviewed: invalidate documents, toast
 *  - application_updated: invalidate application, toast
 *  - task_updated: invalidate tasks, toast
 *  - payment_received: invalidate payments + invoices, toast
 *  - invoice_updated: invalidate invoices, toast
 *  - visa_updated: invalidate visa, toast
 *  - connected: initial hello, sets status to "live"
 */

type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

type RealtimeContextValue = {
  status: ConnectionStatus;
  /** Manually re-trigger connection (e.g. after restoring focus). */
  reconnect: () => void;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "connecting",
  reconnect: () => {},
});

export const useRealtime = () => useContext(RealtimeContext);

/**
 * Map of notification `type` → query keys to invalidate + toast config.
 * When a notification_created event arrives, the client looks up the
 * notification's `type` here to decide what to invalidate and how to
 * surface the toast.
 */
const NOTIFICATION_DISPATCH: Record<
  string,
  { invalidate: string[]; toastVariant?: "success" | "error" }
> = {
  // Messages
  NEW_MESSAGE: { invalidate: ["student-messages", "student-notifications"] },
  // Documents
  DOCUMENT_UPLOADED: { invalidate: ["student-documents"] },
  DOCUMENT_APPROVED: { invalidate: ["student-documents", "student-application"], toastVariant: "success" },
  DOCUMENT_REJECTED: { invalidate: ["student-documents", "student-application"], toastVariant: "error" },
  DOCUMENT_EXPIRED: { invalidate: ["student-documents"] },
  // Appointments
  APPOINTMENT_CONFIRMED: { invalidate: ["student-appointments"], toastVariant: "success" },
  APPOINTMENT_CANCELLED: { invalidate: ["student-appointments"], toastVariant: "error" },
  APPOINTMENT_REMINDER: { invalidate: ["student-appointments"] },
  // Tasks
  TASK_ASSIGNED: { invalidate: ["student-tasks"] },
  TASK_COMPLETED: { invalidate: ["student-tasks"] },
  TASK_OVERDUE: { invalidate: ["student-tasks"], toastVariant: "error" },
  DEADLINE_APPROACHING: { invalidate: ["student-tasks"] },
  // Application
  APPLICATION_STATUS_CHANGED: { invalidate: ["student-application", "student-application-timeline"] },
  APPLICATION_STAGE_CHANGED: { invalidate: ["student-application", "student-application-timeline"] },
  // Visa
  VISA_STATUS_CHANGED: { invalidate: ["student-visa"] },
  VISA_APPROVED: { invalidate: ["student-visa"], toastVariant: "success" },
  VISA_REFUSED: { invalidate: ["student-visa"], toastVariant: "error" },
  // Finance
  PAYMENT_RECEIVED: { invalidate: ["student-payments", "student-invoices"], toastVariant: "success" },
  INVOICE_ISSUED: { invalidate: ["student-invoices"] },
  INVOICE_OVERDUE: { invalidate: ["student-invoices"], toastVariant: "error" },
  // Counseling
  COUNSELING_REQUEST: { invalidate: [] },
  // Default — just invalidate notifications
  DEFAULT: { invalidate: ["student-notifications"] },
};

export function StudentRealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  // Ref to the internal connect function so external callers (the
  // `reconnect` context value) can trigger a reconnect without
  // causing `connect` to be a useCallback that references itself.
  const connectRef = useRef<() => void>(() => {});

  const handleEvent = useCallback(
    (eventData: unknown) => {
      const ev = eventData as {
        type: string;
        studentId?: string;
        payload?: Record<string, unknown> & {
          // notification_created payload shape
          type?: string;
          title?: string;
          message?: string;
          link?: string;
          // message_received payload shape
          conversationId?: string;
          senderName?: string;
          preview?: string;
        };
      };

      if (!ev || typeof ev !== "object") return;

      switch (ev.type) {
        case "connected": {
          setStatus("live");
          break;
        }
        case "message_received": {
          const p = ev.payload ?? {};
          // Invalidate the inbox + the specific chat (if open)
          queryClient.invalidateQueries({ queryKey: ["student-messages"] });
          queryClient.invalidateQueries({ queryKey: ["student-chat"] });
          queryClient.invalidateQueries({ queryKey: ["student-notifications", "unread"] });
          if (p.conversationId) {
            queryClient.invalidateQueries({
              queryKey: ["student-chat", p.conversationId],
            });
          }
          toast({
            title: `New message${p.senderName ? ` from ${p.senderName}` : ""}`,
            description: p.preview ? (p.preview.length > 80 ? p.preview.slice(0, 80) + "…" : p.preview) : undefined,
          });
          break;
        }
        case "notification_created": {
          const p = ev.payload ?? {};
          const notifType = (p.type as string) ?? "DEFAULT";
          // Always invalidate notifications + unread count
          queryClient.invalidateQueries({ queryKey: ["student-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["student-notifications", "unread"] });
          // Look up additional invalidations based on notification type
          const dispatch = NOTIFICATION_DISPATCH[notifType] ?? NOTIFICATION_DISPATCH.DEFAULT;
          for (const key of dispatch.invalidate) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
          // Show toast — suppress for DOCUMENT_UPLOADED (that's the
          // student's own action, they don't need a toast)
          if (notifType !== "DOCUMENT_UPLOADED") {
            toast({
              title: p.title ?? "Notification",
              description: p.message,
              variant: dispatch.toastVariant,
            });
          }
          break;
        }
        case "appointment_updated": {
          queryClient.invalidateQueries({ queryKey: ["student-appointments"] });
          const p = ev.payload ?? {};
          toast({
            title: "Appointment updated",
            description: (p.message as string) ?? undefined,
            variant: (p.status === "CANCELLED" ? "error" : "success"),
          });
          break;
        }
        case "document_reviewed": {
          queryClient.invalidateQueries({ queryKey: ["student-documents"] });
          queryClient.invalidateQueries({ queryKey: ["student-application"] });
          const p = ev.payload ?? {};
          toast({
            title: `Document ${((p.status as string) ?? "updated").toLowerCase()}`,
            description: (p.message as string) ?? (p.name as string) ?? undefined,
            variant: (p.status === "REJECTED" ? "error" : "success"),
          });
          break;
        }
        case "application_updated": {
          queryClient.invalidateQueries({ queryKey: ["student-application"] });
          queryClient.invalidateQueries({ queryKey: ["student-application-timeline"] });
          const p = ev.payload ?? {};
          toast({
            title: "Application updated",
            description: (p.message as string) ?? undefined,
          });
          break;
        }
        case "task_updated": {
          queryClient.invalidateQueries({ queryKey: ["student-tasks"] });
          const p = ev.payload ?? {};
          toast({
            title: "Task updated",
            description: (p.message as string) ?? (p.title as string) ?? undefined,
          });
          break;
        }
        case "payment_received": {
          queryClient.invalidateQueries({ queryKey: ["student-payments"] });
          queryClient.invalidateQueries({ queryKey: ["student-invoices"] });
          const p = ev.payload ?? {};
          toast({
            title: "Payment received",
            description: (p.message as string) ?? undefined,
            variant: "success",
          });
          break;
        }
        case "invoice_updated": {
          queryClient.invalidateQueries({ queryKey: ["student-invoices"] });
          const p = ev.payload ?? {};
          toast({
            title: "Invoice updated",
            description: (p.message as string) ?? undefined,
          });
          break;
        }
        case "visa_updated": {
          queryClient.invalidateQueries({ queryKey: ["student-visa"] });
          const p = ev.payload ?? {};
          toast({
            title: "Visa status updated",
            description: (p.message as string) ?? undefined,
            variant: (p.status === "REFUSED" ? "error" : "success"),
          });
          break;
        }
      }
    },
    [queryClient, toast],
  );

  // Single effect that owns the entire SSE lifecycle:
  //  - opens the connection on mount
  //  - handles reconnection with exponential backoff (2s → 4s → 8s → 15s cap)
  //  - invalidates all student queries on reconnect (catch-up)
  //  - reconnects when the tab becomes visible again (browser may kill
  //    SSE connections when the tab is hidden)
  //  - reconnects when the network comes back online
  //  - cleans up everything on unmount
  //
  // Using a single effect (instead of a `connect` useCallback + multiple
  // effects) avoids the "function references itself before declaration"
  // lint error that the recursive `connect()` call would trigger.
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let prevStatus: ConnectionStatus = "connecting";
    let reconnectAttempts = 0;

    function connect() {
      if (es) {
        es.close();
        es = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      setStatus("connecting");
      es = new EventSource("/api/student/events");

      es.onopen = () => {
        // Detect reconnection (prev status was "reconnecting" or "offline")
        // and invalidate all student queries to catch up on missed events.
        if (prevStatus === "reconnecting" || prevStatus === "offline") {
          queryClient.invalidateQueries({ queryKey: ["student"] });
        }
        reconnectAttempts = 0;
        prevStatus = "live";
        setStatus("live");
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handleEvent(data);
        } catch {
          // Ignore malformed events
        }
      };

      es.onerror = () => {
        prevStatus = "reconnecting";
        setStatus("reconnecting");
        es?.close();
        es = null;
        // Exponential backoff — 2s, 4s, 8s, capped at 15s. Add jitter
        // so multiple clients reconnecting after a server restart
        // don't all retry at the same moment (thundering herd).
        const baseDelay = Math.min(2000 * Math.pow(2, reconnectAttempts), 15000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, baseDelay + Math.random() * 500);
      };
    }

    // Expose connect for the `reconnect` context value
    connectRef.current = connect;

    // Initial connection
    connect();

    // Reconnect when the tab becomes visible again — only if the
    // connection is actually closed (not if it's already connecting/open).
    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        (!es || es.readyState === EventSource.CLOSED)
      ) {
        connect();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Reconnect when the network comes back online — only if the
    // connection is actually closed (prevents unnecessary reconnects
    // when the connection is already live).
    function onOnline() {
      if (!es || es.readyState === EventSource.CLOSED) {
        connect();
      }
    }
    window.addEventListener("online", onOnline);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) es.close();
    };
  }, [handleEvent, queryClient]);

  const reconnect = useCallback(() => {
    connectRef.current();
  }, []);

  return (
    <RealtimeContext.Provider value={{ status, reconnect }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * LiveIndicator — premium pill that shows the SSE connection status
 * with a gradient dot + label. Rendered in the header so the user
 * knows whether real-time updates are flowing.
 *
 * Visual states:
 *  - live:         emerald gradient dot, "Live" label, no pulse
 *  - connecting:   amber gradient dot, "Connecting" label, soft pulse
 *  - reconnecting: amber gradient dot, "Reconnecting" label, soft pulse
 *  - offline:      muted dot, "Offline" label, no pulse
 *
 * The pill has a subtle gradient background + ring that matches the
 * dot color, so the whole element feels "alive" rather than a static
 * label. On mobile we show only the dot (label is hidden via the
 * `showLabel` prop), keeping the header compact.
 */
export function LiveIndicator({ showLabel = true }: { showLabel?: boolean }) {
  const { status } = useRealtime();
  const isLive = status === "live";
  const isConnecting = status === "connecting" || status === "reconnecting";

  const dotClass = isLive
    ? "bg-emerald-500"
    : isConnecting
      ? "bg-amber-500"
      : "bg-muted-foreground";

  const label = isLive
    ? "Live"
    : status === "reconnecting"
      ? "Reconnecting"
      : status === "connecting"
        ? "Connecting"
        : "Offline";

  const ringClass = isLive
    ? "ring-emerald-500/20 bg-emerald-500/10"
    : isConnecting
      ? "ring-amber-500/20 bg-amber-500/10"
      : "ring-border bg-muted/30";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition-colors",
        isLive ? "text-emerald-600 dark:text-emerald-400" : isConnecting ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
        ringClass,
        !showLabel && "px-1",
      )}
      aria-label={`Real-time connection: ${label}`}
      title={`Real-time: ${label}`}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {/* Pulse ring — only when connecting */}
        {isConnecting && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              dotClass,
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotClass)} />
      </span>
      {showLabel && <span className="tabular-nums">{label}</span>}
    </span>
  );
}
