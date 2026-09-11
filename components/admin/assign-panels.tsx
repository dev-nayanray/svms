"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

type StudentOption = { id: string; firstName: string; lastName: string; studentId: string };
type AppOption = { id: string; applicationNumber: string };

/**
 * Assign/reassign a student (assignedEmployeeId) or an application
 * (employeeId) to this employee. Server-side audited.
 */
export function AssignPanels({ employeeId }: { employeeId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [appId, setAppId] = useState("");
  const [busy, setBusy] = useState<"student" | "app" | null>(null);

  const { data: students } = useQuery({
    queryKey: ["/api/students", "assign-options"],
    queryFn: () => apiFetch<{ data: StudentOption[] }>("/api/students?pageSize=100"),
  });
  const { data: apps } = useQuery({
    queryKey: ["/api/applications", "assign-options"],
    queryFn: () => apiFetch<{ data: AppOption[] }>("/api/applications?pageSize=100"),
  });

  const assignStudent = async () => {
    setBusy("student");
    try {
      await apiFetch(`/api/students/${studentId}`, {
        method: "PATCH",
        json: { assignedEmployeeId: employeeId },
      });
      toast({ title: "Student assigned", variant: "success" });
      setStudentId("");
      qc.invalidateQueries();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const assignApp = async () => {
    setBusy("app");
    try {
      await apiFetch(`/api/applications/${appId}/assign`, {
        method: "PATCH",
        json: { employeeId },
      });
      toast({ title: "Application assigned", variant: "success" });
      setAppId("");
      qc.invalidateQueries();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2 rounded-lg border border-border p-4">
        <p className="text-sm font-semibold">Assign / Reassign Student</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            aria-label="Select student to assign"
            className="h-9 min-w-52 flex-1 rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value="">Select student…</option>
            {(students?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.studentId})
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!studentId || busy === "student"} onClick={assignStudent}>
            {busy === "student" ? "Assigning…" : "Assign"}
          </Button>
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-border p-4">
        <p className="text-sm font-semibold">Assign / Reassign Application</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            aria-label="Select application to assign"
            className="h-9 min-w-52 flex-1 rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value="">Select application…</option>
            {(apps?.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.applicationNumber}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!appId || busy === "app"} onClick={assignApp}>
            {busy === "app" ? "Assigning…" : "Assign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
