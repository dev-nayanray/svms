"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";

type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  student?: { firstName: string; lastName: string } | null;
  application?: { applicationNumber: string } | null;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  paymentDate: string | null;
  transactionReference: string | null;
  student: { firstName: string; lastName: string };
  invoice?: { invoiceNumber: string } | null;
};

export function TasksAdmin() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["/api/employees", "options"],
    queryFn: () => apiFetch<{ data: { id: string; user: { id: string; name: string } }[] }>("/api/employees?pageSize=100"),
  });

  const fields: FormField[] = [
    { type: "text", name: "title", label: "Title", required: true },
    { type: "textarea", name: "description", label: "Description" },
    {
      type: "select", name: "assignedToId", label: "Assign to", required: true,
      options: (employees?.data ?? []).map((e) => ({ value: e.id, label: e.user.name })),
    },
    { type: "select", name: "priority", label: "Priority", options: [
      { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" },
      { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" },
    ]},
    { type: "date", name: "dueDate", label: "Due date" },
  ];

  const columns: Column<Task>[] = [
    { key: "title", header: "Title", sortable: true, render: (t) => <span className="font-medium">{t.title}</span> },
    { key: "student", header: "Student", render: (t) => (t.student ? `${t.student.firstName} ${t.student.lastName}` : "—") },
    { key: "priority", header: "Priority", render: (t) => <StatusBadge status={t.priority} /> },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
    {
      key: "dueDate", header: "Due", sortable: true,
      render: (t) => {
        const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "COMPLETED";
        return (
          <span className={overdue ? "font-medium text-destructive" : ""}>
            {overdue ? "Overdue · " : ""}
            {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "—"}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Operational tasks across the team."
        breadcrumbs={["Admin", "Tasks"]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New Task</Button>}
      />
      <DataTable
        endpoint="/api/tasks"
        columns={columns}
        searchPlaceholder="Search tasks…"
        filters={[
          { key: "status", label: "Status", options: ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => ({ value: s, label: s.replace("_", " ") })) },
        ]}
        emptyMessage="No tasks yet."
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New Task" fields={fields}
        endpoint="/api/tasks" invalidateKey="/api/tasks" successMessage="Task created"
      />
    </>
  );
}

export function PaymentsAdmin() {
  const [recordOpen, setRecordOpen] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["/api/students", "options"],
    queryFn: () => apiFetch<{ data: { id: string; firstName: string; lastName: string; studentId: string }[] }>("/api/students?pageSize=100"),
  });

  const fields: FormField[] = [
    {
      type: "select", name: "studentId", label: "Student", required: true,
      options: (students?.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.studentId})` })),
    },
    { type: "number", name: "amount", label: "Amount", required: true },
    { type: "select", name: "paymentMethod", label: "Method", required: true, options: [
      { value: "CASH", label: "Cash" }, { value: "BANK_TRANSFER", label: "Bank transfer" },
      { value: "BKASH", label: "bKash" }, { value: "NAGAD", label: "Nagad" },
      { value: "CARD", label: "Card" }, { value: "OTHER", label: "Other" },
    ]},
    { type: "text", name: "transactionReference", label: "Transaction reference" },
    { type: "date", name: "paymentDate", label: "Payment date" },
  ];

  const columns: Column<Payment>[] = [
    { key: "paymentDate", header: "Date", sortable: true, render: (p) => (p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB") : "—") },
    { key: "student", header: "Student", render: (p) => `${p.student.firstName} ${p.student.lastName}` },
    { key: "invoice", header: "Invoice", render: (p) => p.invoice?.invoiceNumber ?? "—" },
    { key: "amount", header: "Amount", render: (p) => <span className="font-medium">{p.currency} {p.amount.toLocaleString()}</span> },
    { key: "paymentMethod", header: "Method", render: (p) => p.paymentMethod.replace("_", " ") },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description="Recorded payments across students and invoices."
        breadcrumbs={["Admin", "Payments"]}
        actions={<Button onClick={() => setRecordOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Record Payment</Button>}
      />
      <DataTable
        endpoint="/api/payments"
        columns={columns}
        searchPlaceholder="Search payments…"
        filters={[
          { key: "status", label: "Status", options: ["PAID", "PENDING", "PARTIAL", "REFUNDED", "CANCELLED"].map((s) => ({ value: s, label: s })) },
        ]}
        emptyMessage="No payments recorded yet."
      />
      <FormDialog
        open={recordOpen} onOpenChange={setRecordOpen}
        title="Record Payment"
        description="Amounts are validated against invoice dues server-side."
        fields={fields}
        endpoint="/api/payments"
        invalidateKey="/api/payments"
        successMessage="Payment recorded"
        toPayload={(v) => ({ ...v, amount: Number(v.amount) })}
      />
    </>
  );
}
