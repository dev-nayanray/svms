"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column, type RowAction } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

type Appointment = {
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
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; studentId: string; email: string };
  employee: { id: string; user: { id: string; name: string } } | null;
};

const STATUS_FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "requested", label: "Requests" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const columns: Column<Appointment>[] = [
  {
    key: "purpose",
    header: "Purpose",
    sortable: true,
    render: (a) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{a.purpose}</p>
        {a.notes && <p className="truncate text-xs text-muted-foreground">{a.notes}</p>}
      </div>
    ),
  },
  {
    key: "student",
    header: "Student",
    render: (a) => (
      <div className="min-w-0">
        <p className="truncate font-medium">
          {a.student.firstName} {a.student.lastName}
        </p>
        <p className="truncate text-xs text-muted-foreground">{a.student.studentId}</p>
      </div>
    ),
  },
  {
    key: "scheduledAt",
    header: "When",
    sortable: true,
    render: (a) => (
      <div>
        <p className="font-medium">{formatDate(a.scheduledAt)}</p>
        <p className="text-xs text-muted-foreground">{a.durationMins} min</p>
      </div>
    ),
  },
  {
    key: "meetingMethod",
    header: "Type",
    render: (a) => (
      <span className="text-sm">
        {a.meetingMethod === "VIDEO_CALL"
          ? "📹 Video"
          : a.meetingMethod === "PHONE_CALL"
            ? "📞 Phone"
            : a.meetingMethod === "IN_PERSON"
              ? "📍 In-person"
              : "—"}
      </span>
    ),
  },
  {
    key: "employee",
    header: "Counselor",
    render: (a) => a.employee?.user?.name ?? "—",
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (a) => <StatusBadge status={a.status} />,
  },
];

export function AppointmentsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const router = useRouter();

  async function approveRequest(a: Appointment) {
    try {
      await apiFetch(`/api/appointments/${a.id}/approve`, { method: "POST", json: {} });
      toast({ title: "Appointment approved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    }
  }

  async function rejectRequest(a: Appointment) {
    if (!confirm("Reject this appointment request? The student will be notified.")) return;
    try {
      await apiFetch(`/api/appointments/${a.id}/reject`, { method: "POST", json: {} });
      toast({ title: "Request rejected" });
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    }
  }

  const rowActions: RowAction<Appointment>[] = [
    {
      label: "View",
      onClick: (a: Appointment) => {
        router.push(`/admin/appointments/${a.id}`);
      },
    },
    {
      label: "Approve",
      onClick: approveRequest,
    },
    {
      label: "Reject",
      onClick: rejectRequest,
      destructive: true,
    },
  ];

  const filters = [
    {
      key: "view",
      label: "View",
      options: STATUS_FILTERS,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Appointment Management"
        description="View, approve, and manage student appointments across your team."
      />
      <DataTable<Appointment>
        endpoint="/api/appointments"
        columns={columns}
        rowActions={rowActions}
        searchPlaceholder="Search by purpose or student name…"
        filters={filters}
        staticParams={{ view: "upcoming" }}
        emptyMessage="No appointments found."
      />
    </div>
  );
}
