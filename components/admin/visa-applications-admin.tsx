"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button, Label, Textarea } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  VISA_STATUSES,
  VISA_STATUS_LABELS,
  TERMINAL_VISA_STATUSES,
  canTransition,
  type VisaStatus,
} from "@/lib/constants/visa";

type VisaApp = {
  id: string;
  stage: string;
  visaType: string | null;
  submittedAt: string | null;
  biometricsAt: string | null;
  interviewAt: string | null;
  decisionAt: string | null;
  updatedAt: string;
  application: {
    id: string;
    applicationNumber: string;
    student: { id: string; firstName: string; lastName: string; studentId: string };
    country: { id: string; name: string; flag: string | null };
    university: { id: string; name: string } | null;
  };
};

type Meta = {
  countries: { id: string; name: string; flag: string | null }[];
  students: { id: string; firstName: string; lastName: string; studentId: string }[];
  universities: { id: string; name: string }[];
  statuses: { value: string; label: string }[];
};

const stageOptions = VISA_STATUSES.map((s) => ({
  value: s,
  label: VISA_STATUS_LABELS[s],
}));

/**
 * Admin Visa Applications list — full CRUD via reusable components:
 *  - server-side search (application number, student name)
 *  - filters: Stage, Country, Student, University
 *  - sortable columns (stage, submittedAt, biometricsAt, interviewAt,
 *    decisionAt, createdAt, updatedAt)
 *  - row actions: View (detail page), Change Stage (dialog)
 *
 * Stage changes go through PATCH /api/visa with a dialog that shows the
 * allowed transitions + optional note. Every status change is audit-
 * logged + written to ApplicationStatusHistory + syncs the linked
 * application's stageKey + notifies the student.
 */
export function VisaApplicationsAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const [stageChangeVisa, setStageChangeVisa] = useState<VisaApp | null>(null);
  const [targetStage, setTargetStage] = useState<VisaStatus>("SUBMITTED");
  const [stageNote, setStageNote] = useState("");
  const [stageBusy, setStageBusy] = useState(false);

  const { data: meta } = useQuery({
    queryKey: ["/api/visa/meta"],
    queryFn: () => apiFetch<Meta>("/api/visa/meta"),
    staleTime: 5 * 60_000,
  });

  const countryOptions = (meta?.countries ?? []).map((c) => ({
    value: c.id,
    label: `${c.flag ? `${c.flag} ` : ""}${c.name}`,
  }));
  const studentOptions = (meta?.students ?? []).map((s) => ({
    value: s.id,
    label: `${s.firstName} ${s.lastName} (${s.studentId})`,
  }));
  const universityOptions = (meta?.universities ?? []).map((u) => ({
    value: u.id,
    label: u.name,
  }));

  const openStageDialog = (visa: VisaApp) => {
    setStageChangeVisa(visa);
    // Default to the next stage in the flow
    const currentIdx = VISA_STATUSES.indexOf(visa.stage as VisaStatus);
    const nextStage = VISA_STATUSES[currentIdx + 1] ?? "SUBMITTED";
    setTargetStage(canTransition(visa.stage, nextStage) ? nextStage : "SUBMITTED");
    setStageNote("");
  };

  const submitStageChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageChangeVisa) return;
    if (!canTransition(stageChangeVisa.stage, targetStage)) {
      toast({
        title: "Invalid transition",
        description: `Cannot transition from ${stageChangeVisa.stage} to ${targetStage}.`,
        variant: "error",
      });
      return;
    }
    setStageBusy(true);
    try {
      await apiFetch("/api/visa", {
        method: "PATCH",
        json: {
          id: stageChangeVisa.id,
          stage: targetStage,
          note: stageNote.trim() || undefined,
        },
      });
      toast({
        title: `Visa stage updated to ${VISA_STATUS_LABELS[targetStage]}`,
        variant: "success",
      });
      setStageChangeVisa(null);
      // Invalidate the DataTable query
      window.location.reload();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    } finally {
      setStageBusy(false);
    }
  };

  const columns: Column<VisaApp>[] = [
    {
      key: "application",
      header: "Application",
      render: (v) => (
        <button
          onClick={() => router.push(`/admin/visa/${v.id}`)}
          className="font-mono text-xs font-medium text-primary hover:underline"
        >
          {v.application.applicationNumber}
        </button>
      ),
    },
    {
      key: "student",
      header: "Student",
      render: (v) => (
        <div>
          <p className="font-medium">
            {v.application.student.firstName} {v.application.student.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{v.application.student.studentId}</p>
        </div>
      ),
    },
    {
      key: "country",
      header: "Country",
      render: (v) => (
        <span className="inline-flex items-center gap-1">
          {v.application.country.flag && <span aria-hidden>{v.application.country.flag}</span>}
          {v.application.country.name}
        </span>
      ),
    },
    {
      key: "university",
      header: "University",
      render: (v) => v.application.university?.name ?? "—",
    },
    { key: "visaType", header: "Visa Type", render: (v) => v.visaType ?? "—" },
    {
      key: "stage",
      header: "Stage",
      sortable: true,
      render: (v) => <StatusBadge status={v.stage} />,
    },
    {
      key: "submittedAt",
      header: "Submitted",
      sortable: true,
      render: (v) => (v.submittedAt ? new Date(v.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"),
    },
    {
      key: "decisionAt",
      header: "Decision",
      sortable: true,
      render: (v) => (v.decisionAt ? new Date(v.decisionAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"),
    },
  ];

  return (
    <>
      <PageHeader
        title="Visa Applications"
        description="Track visa cases through preparation, submission, biometrics, interview, and decision. Every status change is audit-logged."
        breadcrumbs={["Admin", "Visa Management", "Visa Applications"]}
      />

      <DataTable
        endpoint="/api/visa"
        columns={columns}
        searchPlaceholder="Search by application number or student name…"
        filters={[
          { key: "stage", label: "Stage", options: stageOptions },
          { key: "countryId", label: "Country", options: countryOptions },
          { key: "studentId", label: "Student", options: studentOptions },
          { key: "universityId", label: "University", options: universityOptions },
        ]}
        emptyMessage="No visa applications yet — visa records are created when an application reaches the visa stage."
        rowActions={[
          { label: "View", onClick: (v) => router.push(`/admin/visa/${v.id}`) },
          { label: "Change Stage", onClick: (v) => openStageDialog(v) },
        ]}
      />

      {/* Stage change dialog */}
      {stageChangeVisa && (
        <Dialog open onOpenChange={(v) => !v && setStageChangeVisa(null)}>
          <DialogContent
            title={`Change Visa Stage — ${stageChangeVisa.application.applicationNumber}`}
            description={`Student: ${stageChangeVisa.application.student.firstName} ${stageChangeVisa.application.student.lastName} · Current: ${VISA_STATUS_LABELS[stageChangeVisa.stage as VisaStatus] ?? stageChangeVisa.stage}`}
            className="max-w-md"
          >
            <form onSubmit={submitStageChange} className="space-y-3">
              {(TERMINAL_VISA_STATUSES as readonly string[]).includes(stageChangeVisa.stage) && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  This visa is in a terminal status ({stageChangeVisa.stage}). No further
                  transitions are allowed.
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="target-stage">New stage</Label>
                <select
                  id="target-stage"
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value as VisaStatus)}
                  className="flex h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-sm"
                  disabled={(TERMINAL_VISA_STATUSES as readonly string[]).includes(stageChangeVisa.stage)}
                >
                  {VISA_STATUSES.filter((s) => canTransition(stageChangeVisa.stage, s)).map((s) => (
                    <option key={s} value={s}>
                      {VISA_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stage-note">Note (optional)</Label>
                <Textarea
                  id="stage-note"
                  value={stageNote}
                  onChange={(e) => setStageNote(e.target.value)}
                  placeholder="e.g. Biometrics appointment scheduled for 15 Oct"
                  maxLength={2000}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStageChangeVisa(null)}
                  disabled={stageBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    stageBusy ||
                    (TERMINAL_VISA_STATUSES as readonly string[]).includes(stageChangeVisa.stage)
                  }
                >
                  {stageBusy ? "Updating…" : "Update Stage"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
