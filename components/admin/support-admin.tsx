"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column, type RowAction } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

type SupportRequest = {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  response: string | null;
  createdAt: string;
  updatedAt: string;
  student: { id: string; firstName: string; lastName: string; studentId: string; email: string };
};

const columns: Column<SupportRequest>[] = [
  {
    key: "subject",
    header: "Subject",
    sortable: true,
    render: (s) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{s.subject}</p>
        <p className="truncate text-xs text-muted-foreground">{s.category}</p>
      </div>
    ),
  },
  {
    key: "student",
    header: "Student",
    render: (s) => (
      <div className="min-w-0">
        <p className="truncate font-medium">
          {s.student.firstName} {s.student.lastName}
        </p>
        <p className="truncate text-xs text-muted-foreground">{s.student.studentId}</p>
      </div>
    ),
  },
  {
    key: "priority",
    header: "Priority",
    sortable: true,
    render: (s) => <StatusBadge status={s.priority} />,
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (s) => <StatusBadge status={s.status} />,
  },
  {
    key: "createdAt",
    header: "Submitted",
    sortable: true,
    render: (s) => <span className="text-sm">{formatDate(s.createdAt)}</span>,
  },
];

export function SupportAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const router = useRouter();

  async function quickResolve(s: SupportRequest) {
    try {
      await apiFetch(`/api/support/${s.id}/resolve`, { method: "POST" });
      toast({ title: "Marked as resolved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/support"] });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    }
  }

  const rowActions: RowAction<SupportRequest>[] = [
    {
      label: "View",
      onClick: (s: SupportRequest) => {
        router.push(`/admin/support/${s.id}`);
      },
    },
    {
      label: "Resolve",
      onClick: quickResolve,
    },
  ];

  const filters = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "OPEN", label: "Open" },
        { value: "IN_PROGRESS", label: "In Progress" },
        { value: "RESOLVED", label: "Resolved" },
        { value: "CLOSED", label: "Closed" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support Management"
        description="View, respond to, and resolve student support requests."
      />
      <DataTable<SupportRequest>
        endpoint="/api/support"
        columns={columns}
        rowActions={rowActions}
        searchPlaceholder="Search by subject or student name…"
        filters={filters}
        staticParams={{ status: "OPEN" }}
        emptyMessage="No support requests found."
      />
    </div>
  );
}
