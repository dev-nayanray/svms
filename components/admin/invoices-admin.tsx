"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  formatMoney,
} from "@/lib/constants/finance";
import { formatDate } from "@/lib/utils";

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
  dueDate: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  application: { id: string; applicationNumber: string } | null;
  _count?: { payments: number };
};

type Student = { id: string; firstName: string; lastName: string; studentId: string };

const statusOptions = INVOICE_STATUSES.map((s) => ({
  value: s,
  label: INVOICE_STATUS_LABELS[s],
}));

/**
 * Admin Invoices list — full CRUD via reusable components:
 *  - search (invoice number)
 *  - filters: Status, Student
 *  - sortable columns (invoiceNumber, total, paidAmount, dueAmount, status, issueDate, dueDate, createdAt)
 *  - row actions: View (detail page), Archive
 *  - create invoice dialog
 *  - links to printable invoice view
 */
export function InvoicesAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/invoices"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [archiveInvoice, setArchiveInvoice] = useState<Invoice | null>(null);

  const { data: students } = useQuery({
    queryKey: ["/api/students", "options"],
    queryFn: () =>
      apiFetch<{ data: Student[] }>("/api/students?pageSize=100"),
  });
  const studentOptions = (students?.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.firstName} ${s.lastName} (${s.studentId})`,
  }));

  const fields: FormField[] = [
    {
      type: "select",
      name: "studentId",
      label: "Student",
      required: true,
      options: studentOptions,
    },
    { type: "text", name: "itemDescription", label: "Line item description", required: true, placeholder: "Service charge" },
    { type: "number", name: "itemQuantity", label: "Quantity", required: true, placeholder: "1" },
    { type: "number", name: "itemUnitPrice", label: "Unit price", required: true },
    { type: "number", name: "discount", label: "Discount" },
    { type: "date", name: "dueDate", label: "Due date" },
  ];

  const columns: Column<Invoice>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      sortable: true,
      render: (i) => (
        <Link
          href={`/admin/invoices/${i.id}`}
          className="font-mono text-xs font-medium text-primary hover:underline"
        >
          {i.invoiceNumber}
        </Link>
      ),
    },
    {
      key: "student",
      header: "Student",
      render: (i) => (
        <div>
          <p className="font-medium">
            {i.student.firstName} {i.student.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{i.student.studentId}</p>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (i) => <span className="font-medium">{formatMoney(i.total)}</span>,
    },
    {
      key: "paidAmount",
      header: "Paid",
      sortable: true,
      render: (i) => formatMoney(i.paidAmount),
    },
    {
      key: "dueAmount",
      header: "Due",
      sortable: true,
      render: (i) => (
        <span className={i.dueAmount > 0 ? "font-medium text-warning" : ""}>
          {formatMoney(i.dueAmount)}
        </span>
      ),
    },
    {
      key: "issueDate",
      header: "Issued",
      sortable: true,
      render: (i) => (i.issueDate ? formatDate(i.issueDate) : "—"),
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortable: true,
      render: (i) => (i.dueDate ? formatDate(i.dueDate) : "—"),
    },
    { key: "status", header: "Status", sortable: true, render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Billing with server-computed totals. Financial records are never hard-deleted — only archived."
        breadcrumbs={["Admin", "Invoices"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New Invoice
          </Button>
        }
      />

      <DataTable
        endpoint="/api/invoices"
        columns={columns}
        searchPlaceholder="Search by invoice number…"
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          ...(studentOptions.length > 0
            ? [{ key: "studentId", label: "Student", options: studentOptions }]
            : []),
        ]}
        emptyMessage="No invoices yet."
        rowActions={[
          { label: "View", onClick: (i) => router.push(`/admin/invoices/${i.id}`) },
          {
            label: "Print",
            onClick: (i) => window.open(`/admin/invoices/${i.id}?print=1`, "_blank"),
          },
          {
            label: "Archive",
            destructive: true,
            onClick: (i) => setArchiveInvoice(i),
          },
        ]}
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
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

      <ConfirmDialog
        open={!!archiveInvoice}
        onOpenChange={(v) => !v && setArchiveInvoice(null)}
        title="Archive Invoice"
        message={`Archive ${archiveInvoice?.invoiceNumber}? Archived invoices are hidden from the default list but retain their data for audit trails.`}
        confirmLabel="Archive"
        destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/invoices/${archiveInvoice!.id}`, { method: "DELETE" });
            toast({ title: "Invoice archived", variant: "success" });
            invalidate();
          } catch (err) {
            toast({ title: "Failed", description: (err as Error).message, variant: "error" });
            throw err;
          }
        }}
      />
    </>
  );
}
