"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

type Invoice = {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  issueDate: string | null;
  student: { firstName: string; lastName: string };
};

type VisaApp = {
  id: string;
  stage: string;
  submittedAt: string | null;
  decisionAt: string | null;
  application: {
    applicationNumber: string;
    country: { name: string };
    student: { firstName: string; lastName: string };
  };
};

export function InvoicesAdmin() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["/api/students", "options"],
    queryFn: () => apiFetch<{ data: { id: string; firstName: string; lastName: string; studentId: string }[] }>("/api/students?pageSize=100"),
  });

  const fields: FormField[] = [
    {
      type: "select", name: "studentId", label: "Student", required: true,
      options: (students?.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.studentId})` })),
    },
    { type: "text", name: "itemDescription", label: "Line item description", required: true, placeholder: "Service charge" },
    { type: "number", name: "itemQuantity", label: "Quantity", required: true, placeholder: "1" },
    { type: "number", name: "itemUnitPrice", label: "Unit price", required: true },
    { type: "number", name: "discount", label: "Discount" },
    { type: "date", name: "dueDate", label: "Due date" },
  ];

  const columns: Column<Invoice>[] = [
    { key: "invoiceNumber", header: "Invoice", sortable: true, render: (i) => (
      <Link href={`/admin/invoices/${i.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
        {i.invoiceNumber}
      </Link>
    )},
    { key: "student", header: "Student", render: (i) => `${i.student.firstName} ${i.student.lastName}` },
    { key: "total", header: "Total", render: (i) => <span className="font-medium">{i.total.toLocaleString()}</span> },
    { key: "paidAmount", header: "Paid", render: (i) => i.paidAmount.toLocaleString() },
    { key: "dueAmount", header: "Due", render: (i) => <span className={i.dueAmount > 0 ? "font-medium text-warning" : ""}>{i.dueAmount.toLocaleString()}</span> },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Billing with server-computed totals."
        breadcrumbs={["Admin", "Invoices"]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New Invoice</Button>}
      />
      <DataTable
        endpoint="/api/invoices"
        columns={columns}
        searchPlaceholder="Search invoices…"
        filters={[
          { key: "status", label: "Status", options: ["DRAFT", "ISSUED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"].map((s) => ({ value: s, label: s })) },
        ]}
        emptyMessage="No invoices yet."
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New Invoice"
        description="Totals are calculated server-side; client values are never trusted."
        fields={fields}
        endpoint="/api/invoices"
        invalidateKey="/api/invoices"
        successMessage="Invoice created"
        toPayload={(v) => ({
          studentId: v.studentId,
          discount: Number(v.discount ?? 0),
          ...(v.dueDate ? { dueDate: v.dueDate } : {}),
          items: [
            {
              description: v.itemDescription,
              quantity: Number(v.itemQuantity ?? 1),
              unitPrice: Number(v.itemUnitPrice),
            },
          ],
        })}
      />
    </>
  );
}

const VISA_STAGES = [
  "VISA_PREPARATION", "VISA_SUBMITTED", "BIOMETRICS", "INTERVIEW", "APPROVED", "REFUSED",
];

export function VisaApplicationsAdmin() {
  const { toast } = useToast();

  const updateStage = async (id: string, stage: string) => {
    try {
      await apiFetch("/api/visa", { method: "PATCH", json: { id, stage } });
      toast({ title: `Visa stage updated to ${stage.replace("_", " ").toLowerCase()}`, variant: "success" });
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "error" });
    }
  };

  const columns: Column<VisaApp>[] = [
    { key: "number", header: "Application", render: (v) => v.application.applicationNumber },
    { key: "student", header: "Student", render: (v) => `${v.application.student.firstName} ${v.application.student.lastName}` },
    { key: "country", header: "Country", render: (v) => v.application.country.name },
    { key: "stage", header: "Stage", render: (v) => <StatusBadge status={v.stage} /> },
    { key: "submittedAt", header: "Submitted", render: (v) => (v.submittedAt ? new Date(v.submittedAt).toLocaleDateString("en-GB") : "—") },
    { key: "decisionAt", header: "Decision", render: (v) => (v.decisionAt ? new Date(v.decisionAt).toLocaleDateString("en-GB") : "—") },
  ];

  return (
    <>
      <PageHeader
        title="Visa Applications"
        description="Track visa cases through submission, biometrics, and decision."
        breadcrumbs={["Admin", "Visa Management", "Visa Applications"]}
      />
      <DataTable
        endpoint="/api/visa"
        columns={columns}
        searchPlaceholder="Search by application number…"
        filters={[
          { key: "stage", label: "Stage", options: VISA_STAGES.map((s) => ({ value: s, label: s.replace("_", " ") })) },
        ]}
        emptyMessage="No visa applications yet — visa records are created when an application reaches VISA_PREPARATION."
        rowActions={VISA_STAGES.slice(1).map((s) => ({
          label: s === "APPROVED" ? "Approve" : s === "REFUSED" ? "Refuse" : `→ ${s.replace("_", " ")}`,
          destructive: s === "REFUSED",
          onClick: (v: VisaApp) => updateStage(v.id, s),
        }))}
      />
    </>
  );
}
