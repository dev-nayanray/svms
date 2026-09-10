"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button, Label, Textarea } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatMoney,
} from "@/lib/constants/finance";
import { formatDate } from "@/lib/utils";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionReference: string | null;
  status: string;
  paymentDate: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  application: { id: string; applicationNumber: string } | null;
  invoice: { id: string; invoiceNumber: string } | null;
};

type Student = { id: string; firstName: string; lastName: string; studentId: string };

const statusOptions = PAYMENT_STATUSES.map((s) => ({
  value: s,
  label: PAYMENT_STATUS_LABELS[s],
}));

const methodOptions = PAYMENT_METHODS.map((m) => ({
  value: m,
  label: PAYMENT_METHOD_LABELS[m],
}));

/**
 * Admin Payments list — full CRUD via reusable components:
 *  - search (transaction reference)
 *  - filters: Status, Method, Student, date range
 *  - sortable columns (amount, paymentMethod, paymentDate, status, createdAt)
 *  - row actions: Edit, Refund, Archive
 *  - record payment dialog
 */
export function PaymentsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/payments"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [refundPayment, setRefundPayment] = useState<Payment | null>(null);
  const [archivePayment, setArchivePayment] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [paymentFrom, setPaymentFrom] = useState("");
  const [paymentTo, setPaymentTo] = useState("");

  const { data: students } = useQuery({
    queryKey: ["/api/students", "options"],
    queryFn: () =>
      apiFetch<{ data: Student[] }>("/api/students?pageSize=100"),
  });
  const studentOptions = (students?.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.firstName} ${s.lastName} (${s.studentId})`,
  }));

  const staticParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (paymentFrom) p.paymentFrom = paymentFrom;
    if (paymentTo) p.paymentTo = paymentTo;
    return p;
  }, [paymentFrom, paymentTo]);

  const createFields: FormField[] = [
    {
      type: "select",
      name: "studentId",
      label: "Student",
      required: true,
      options: studentOptions,
    },
    { type: "number", name: "amount", label: "Amount", required: true },
    { type: "text", name: "currency", label: "Currency", placeholder: "BDT" },
    {
      type: "select",
      name: "paymentMethod",
      label: "Payment method",
      required: true,
      options: methodOptions,
    },
    { type: "text", name: "transactionReference", label: "Transaction reference" },
    { type: "date", name: "paymentDate", label: "Payment date" },
  ];

  const editFields: FormField[] = [
    { type: "number", name: "amount", label: "Amount", required: true },
    { type: "text", name: "currency", label: "Currency" },
    {
      type: "select",
      name: "paymentMethod",
      label: "Payment method",
      options: methodOptions,
    },
    { type: "text", name: "transactionReference", label: "Transaction reference" },
    { type: "date", name: "paymentDate", label: "Payment date" },
  ];

  const columns: Column<Payment>[] = [
    {
      key: "student",
      header: "Student",
      render: (p) => (
        <div>
          <p className="font-medium">
            {p.student.firstName} {p.student.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{p.student.studentId}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (p) => (
        <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>
      ),
    },
    {
      key: "paymentMethod",
      header: "Method",
      sortable: true,
      render: (p) =>
        PAYMENT_METHOD_LABELS[p.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ??
        p.paymentMethod,
    },
    {
      key: "transactionReference",
      header: "Reference",
      render: (p) => (
        <span className="font-mono text-xs text-muted-foreground">
          {p.transactionReference ?? "—"}
        </span>
      ),
    },
    {
      key: "paymentDate",
      header: "Date",
      sortable: true,
      render: (p) => (p.paymentDate ? formatDate(p.paymentDate) : "—"),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (p) => <StatusBadge status={p.status} />,
    },
  ];

  const submitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundPayment) return;
    setRefundBusy(true);
    try {
      await apiFetch(`/api/payments/${refundPayment.id}/refund`, {
        method: "POST",
        json: { reason: refundReason.trim() || undefined },
      });
      toast({
        title: "Payment refunded",
        description: `${formatMoney(refundPayment.amount, refundPayment.currency)} refunded.`,
        variant: "success",
      });
      setRefundPayment(null);
      setRefundReason("");
      invalidate();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setRefundBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Payments"
        description="Recorded payments across students and invoices. Financial records are never hard-deleted — only archived."
        breadcrumbs={["Admin", "Payments"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Record Payment
          </Button>
        }
      />

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="payment-from" className="block text-xs text-muted-foreground">
            Payment from
          </label>
          <input
            id="payment-from"
            type="date"
            value={paymentFrom}
            onChange={(e) => setPaymentFrom(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="payment-to" className="block text-xs text-muted-foreground">
            Payment to
          </label>
          <input
            id="payment-to"
            type="date"
            value={paymentTo}
            onChange={(e) => setPaymentTo(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        {(paymentFrom || paymentTo) && (
          <Button
            variant="outline"
            size="sm"
            className="mb-1.5"
            onClick={() => {
              setPaymentFrom("");
              setPaymentTo("");
            }}
          >
            Clear dates
          </Button>
        )}
      </div>

      <DataTable
        endpoint="/api/payments"
        columns={columns}
        searchPlaceholder="Search by transaction reference…"
        staticParams={staticParams}
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          { key: "paymentMethod", label: "Method", options: methodOptions },
          ...(studentOptions.length > 0
            ? [{ key: "studentId", label: "Student", options: studentOptions }]
            : []),
        ]}
        emptyMessage="No payments recorded yet."
        rowActions={[
          { label: "Edit", onClick: (p) => setEditPayment(p) },
          {
            label: "Refund",
            destructive: true,
            onClick: (p) => {
              if (p.status === "REFUNDED") {
                toast({ title: "Already refunded", variant: "error" });
                return;
              }
              if (p.status === "CANCELLED") {
                toast({ title: "Cannot refund a cancelled payment", variant: "error" });
                return;
              }
              setRefundPayment(p);
              setRefundReason("");
            },
          },
          {
            label: "Archive",
            destructive: true,
            onClick: (p) => setArchivePayment(p),
          },
        ]}
      />

      {/* Record payment dialog */}
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Record Payment"
        description="Amounts are validated against invoice dues server-side."
        fields={createFields}
        endpoint="/api/payments"
        invalidateKey="/api/payments"
        successMessage="Payment recorded"
        toPayload={(v) => ({
          ...v,
          amount: Number(v.amount),
          currency: v.currency || "BDT",
          paymentDate: v.paymentDate || undefined,
        })}
      />

      {/* Edit payment dialog */}
      {editPayment && (
        <FormDialog
          key={editPayment.id}
          open={!!editPayment}
          onOpenChange={(v) => !v && setEditPayment(null)}
          title={`Edit Payment — ${formatMoney(editPayment.amount, editPayment.currency)}`}
          fields={editFields}
          endpoint="/api/payments"
          entityId={editPayment.id}
          invalidateKey="/api/payments"
          successMessage="Payment updated"
          toPayload={(v) => ({
            amount: Number(v.amount),
            currency: v.currency || "BDT",
            paymentMethod: v.paymentMethod,
            transactionReference: v.transactionReference || undefined,
            paymentDate: v.paymentDate || undefined,
          })}
        />
      )}

      {/* Refund dialog */}
      {refundPayment && (
        <Dialog open onOpenChange={(v) => !v && setRefundPayment(null)}>
          <DialogContent
            title={`Refund Payment — ${formatMoney(refundPayment.amount, refundPayment.currency)}`}
            description={`Student: ${refundPayment.student.firstName} ${refundPayment.student.lastName}`}
            className="max-w-md"
          >
            <form onSubmit={submitRefund} className="space-y-3">
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                This will reverse the payment and adjust the linked invoice&apos;s
                paid/due amounts. Refunded payments cannot be edited.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="refund-reason">Reason (optional)</Label>
                <Textarea
                  id="refund-reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Duplicate payment — student paid twice."
                  maxLength={2000}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRefundPayment(null)}
                  disabled={refundBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={refundBusy} variant="destructive">
                  {refundBusy ? "Processing…" : "Refund"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        open={!!archivePayment}
        onOpenChange={(v) => !v && setArchivePayment(null)}
        title="Archive Payment"
        message={`Archive this payment of ${formatMoney(archivePayment?.amount, archivePayment?.currency)}? Archived payments are hidden from the default list but retain their data for audit trails.`}
        confirmLabel="Archive"
        destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/payments/${archivePayment!.id}`, { method: "DELETE" });
            toast({ title: "Payment archived", variant: "success" });
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
