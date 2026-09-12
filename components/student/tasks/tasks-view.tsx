"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  RefreshCw,
  Square,
  WifiOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button, Badge } from "@/components/ui";
import { MobilePage, MobileCard } from "@/components/student/ui";
import { Skeleton } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  type TaskView,
} from "@/lib/constants/tasks";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  applicationId: string | null;
  application: { id: string; applicationNumber: string } | null;
  studentId: string | null;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
};

type ListResponse = { tasks: Task[] };

const TABS: { value: TaskView; label: string; icon: React.ReactNode }[] = [
  { value: "today", label: "Today", icon: <CalendarClock className="h-3.5 w-3.5" /> },
  { value: "upcoming", label: "Upcoming", icon: <Clock className="h-3.5 w-3.5" /> },
  { value: "overdue", label: "Overdue", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { value: "completed", label: "Completed", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { value: "all", label: "All", icon: <CheckSquare className="h-3.5 w-3.5" /> },
];

const PRIORITY_TONE: Record<string, "default" | "info" | "warning" | "destructive"> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

// ── Component ──────────────────────────────────────────────────────

export function TasksView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TaskView>("today");

  const listQ = useQuery<ListResponse>({
    queryKey: ["student-tasks", activeTab],
    queryFn: () =>
      apiFetch<ListResponse>(`/api/student/tasks?view=${activeTab}`),
    retry: false,
    staleTime: 15_000,
  });

  const tasks = useMemo(() => listQ.data?.tasks ?? [], [listQ.data]);
  const online = useOnlineStatus();

  // Loading
  if (listQ.isLoading && !listQ.data) {
    return (
      <MobilePage>
        <TasksSkeleton />
      </MobilePage>
    );
  }

  // Error
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
            {!online ? "You're offline" : "Couldn't load your tasks"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {!online
              ? "Check your connection and try again."
              : listQ.error instanceof Error
                ? listQ.error.message
                : "Please try again in a moment."}
          </p>
          <Button onClick={() => listQ.refetch()} className="mt-4" disabled={!online}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </Button>
        </MobileCard>
      </MobilePage>
    );
  }

  // Count per tab (derived from the current data — the actual server
  // returns only the active tab's tasks, so the counts here are for the
  // active tab only. The full counts would need a separate query, but
  // for the UX this is sufficient — the badge on the active tab shows
  // how many tasks are in that view.)
  const activeCount = tasks.length;

  async function handleComplete(taskId: string) {
    // Optimistic: mark as COMPLETED locally
    qc.setQueryData<ListResponse>(["student-tasks", activeTab], (prev) =>
      prev
        ? {
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? { ...t, status: "COMPLETED", completedAt: new Date().toISOString(), overdue: false }
                : t,
            ),
          }
        : prev,
    );
    try {
      await apiFetch(`/api/student/tasks/${taskId}/complete`, { method: "POST" });
      toast({ title: "Task completed", variant: "success" });
      // Invalidate all task queries so the other tabs update too
      qc.invalidateQueries({ queryKey: ["student-tasks"] });
    } catch (err) {
      // Roll back on failure
      qc.invalidateQueries({ queryKey: ["student-tasks"] });
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    }
  }

  async function handleStart(taskId: string) {
    // Optimistic: mark as IN_PROGRESS locally
    qc.setQueryData<ListResponse>(["student-tasks", activeTab], (prev) =>
      prev
        ? {
            tasks: prev.tasks.map((t) =>
              t.id === taskId ? { ...t, status: "IN_PROGRESS" } : t,
            ),
          }
        : prev,
    );
    try {
      await apiFetch(`/api/student/tasks/${taskId}`, {
        method: "PATCH",
        json: { status: "IN_PROGRESS" },
      });
      qc.invalidateQueries({ queryKey: ["student-tasks"] });
    } catch (err) {
      qc.invalidateQueries({ queryKey: ["student-tasks"] });
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    }
  }

  return (
    <MobilePage>
      {/* Tab bar */}
      <div className="sticky top-14 z-20 -mx-4 overflow-x-auto border-b border-border bg-card/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:static md:mx-0 md:rounded-lg md:border md:bg-card md:backdrop-blur-none">
        <div className="flex min-w-max gap-1.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                aria-pressed={isActive}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.icon}
                {tab.label}
                {isActive && activeCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold">
                    {activeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {tasks.length === 0 ? (
        <MobileCard className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold">
            {activeTab === "today" && "No tasks due today"}
            {activeTab === "upcoming" && "No upcoming tasks"}
            {activeTab === "overdue" && "No overdue tasks"}
            {activeTab === "completed" && "No completed tasks yet"}
            {activeTab === "all" && "No tasks assigned to you"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {activeTab === "completed"
              ? "Tasks you complete will appear here."
              : "Your counselor will assign tasks as your application progresses."}
          </p>
          {activeTab !== "all" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setActiveTab("all")}
            >
              View all tasks
            </Button>
          )}
        </MobileCard>
      ) : (
        /* Task list */
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onStart={handleStart}
            />
          ))}
        </div>
      )}

      {/* Refresh + offline indicator */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{listQ.isFetching ? "Refreshing…" : "Updated just now"}</span>
        {!online && (
          <span className="flex items-center gap-1 text-warning">
            <WifiOff className="h-3 w-3" aria-hidden /> Offline
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching} aria-label="Refresh list">
          <RefreshCw className={cn("h-3.5 w-3.5", listQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </MobilePage>
  );
}

// ── Task card ──────────────────────────────────────────────────────

function TaskCard({
  task,
  onComplete,
  onStart,
}: {
  task: Task;
  onComplete: (taskId: string) => void;
  onStart: (taskId: string) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const isCompleted = task.status === "COMPLETED";
  const isCancelled = task.status === "CANCELLED";
  const isOverdue = task.overdue;
  const isInProgress = task.status === "IN_PROGRESS";
  const isTodo = task.status === "TODO";

  async function handleCompleteClick() {
    setCompleting(true);
    await onComplete(task.id);
    setCompleting(false);
  }

  async function handleStartClick() {
    await onStart(task.id);
  }

  return (
    <MobileCard
      className={cn(
        "space-y-2 p-3",
        isOverdue && "border-destructive/40",
        isCompleted && "border-success/30 bg-success/5",
      )}
    >
      {/* Header: checkbox + title + priority */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={isTodo || isInProgress ? handleCompleteClick : undefined}
          disabled={isCompleted || isCancelled || completing}
          aria-label={isCompleted ? "Task completed" : "Mark as completed"}
          className="mt-0.5 shrink-0 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default"
        >
          {isCompleted ? (
            <CheckSquare className="h-5 w-5 text-success" aria-hidden />
          ) : isCancelled ? (
            <Square className="h-5 w-5 text-muted-foreground/50" aria-hidden />
          ) : completing ? (
            <RefreshCw className="h-5 w-5 animate-spin text-primary" aria-hidden />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground hover:text-primary" aria-hidden />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-sm font-semibold leading-tight",
            isCompleted && "text-muted-foreground line-through",
            isCancelled && "text-muted-foreground/70 line-through",
          )}>
            {task.title}
          </p>
          {task.description && !isCompleted && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}
        </div>
        <Badge tone={PRIORITY_TONE[task.priority] ?? "default"}>
          {TASK_PRIORITY_LABELS[task.priority as keyof typeof TASK_PRIORITY_LABELS] ?? task.priority}
        </Badge>
      </div>

      {/* Meta row: deadline + status + application */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-[11px] text-muted-foreground">
        {task.dueDate && (
          <span className={cn(
            "inline-flex items-center gap-1",
            isOverdue && "font-semibold text-destructive",
          )}>
            <CalendarClock className="h-3 w-3" aria-hidden />
            {DeadlineLabel(task.dueDate, task.status)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden />
          {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
        </span>
        {task.application && (
          <Link
            href={`/student/application`}
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            <FileText className="h-3 w-3" aria-hidden />
            {task.application.applicationNumber}
          </Link>
        )}
      </div>

      {/* Action row */}
      {!isCompleted && !isCancelled && (
        <div className="flex items-center gap-2 pl-7">
          {isTodo && (
            <Button size="sm" variant="outline" onClick={handleStartClick} className="min-h-[36px]">
              Start
            </Button>
          )}
          {isInProgress && (
            <Button size="sm" variant="default" onClick={handleCompleteClick} disabled={completing} className="min-h-[36px]">
              {completing ? "Completing…" : "Mark Done"}
            </Button>
          )}
          {isOverdue && (
            <span className="text-[11px] font-medium text-destructive">
              Overdue — please complete as soon as possible
            </span>
          )}
        </div>
      )}
    </MobileCard>
  );
}

// ── Deadline label helper ──────────────────────────────────────────

function DeadlineLabel(dueDate: string, status: string): string {
  try {
    const date = parseISO(dueDate);
    const now = new Date();
    const days = differenceInDays(date, now);

    if (status === "COMPLETED" || status === "CANCELLED") {
      return format(date, "MMM d, yyyy");
    }

    if (days < 0) {
      const absDays = Math.abs(days);
      if (absDays === 1) return "1 day overdue";
      return `${absDays} days overdue`;
    }
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    if (days <= 3) return `Due in ${days} days`;
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

// ── Loading skeleton ───────────────────────────────────────────────

function TasksSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading tasks">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <MobileCard key={i}>
            <div className="flex items-start gap-2.5">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </MobileCard>
        ))}
      </div>
    </div>
  );
}

// ── Online status hook ─────────────────────────────────────────────

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
