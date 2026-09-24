"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronDown, UserCheck } from "lucide-react";
import { Button, Select, Label, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { LEAD_STATUSES } from "@/lib/services/lead-cases";
import { titleCase } from "@/lib/utils";

export function LeadActions({
  leadId,
  currentStatus,
  canManage,
  canConvert,
}: {
  leadId: string;
  currentStatus: string;
  canManage: boolean;
  canConvert: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState<"status" | "convert" | null>(null);

  const changeStatus = async () => {
    if (status === currentStatus) return;
    setSaving("status");
    try {
      const res = await fetch(`/api/employee/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      toast({ title: "Status changed", description: `${currentStatus} → ${status}`, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Could not change status", description: err instanceof Error ? err.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(null);
    }
  };

  const convert = async () => {
    setSaving("convert");
    try {
      const res = await fetch(`/api/employee/leads/${leadId}/convert`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      toast({ title: "Lead converted!", description: `Student created with ID ${data.data.studentId}`, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Conversion failed", description: err instanceof Error ? err.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-end gap-1.5">
        <div className="space-y-0.5">
          <Label className="text-[10px] uppercase">Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={saving !== null} className="h-8 text-xs">
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s} disabled={s === "CONVERTED"}>{titleCase(s)}</option>
            ))}
          </Select>
        </div>
        <Button onClick={changeStatus} disabled={saving !== null || status === currentStatus} size="sm" className="h-8">
          {saving === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Update
        </Button>
      </div>

      {canConvert && (
        <Button onClick={convert} disabled={saving !== null} size="sm" className="h-8 bg-success text-success-foreground hover:bg-success/90">
          {saving === "convert" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          Convert to Student
        </Button>
      )}
    </div>
  );
}
