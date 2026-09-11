"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, GraduationCap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button, Badge } from "@/components/ui";
import { MobileCard } from "@/components/student/ui";
import { ProfileSheet, Field } from "./profile-sheet";
import { Input, Select, Label } from "@/components/ui";
import { academicRecordCreateSchema, academicRecordUpdateSchema } from "@/lib/validations";

type AcademicRecord = {
  id: string;
  level: string;
  institution: string;
  group?: string | null;
  subject?: string | null;
  result?: string | null;
  passingYear?: number | null;
  certificateUrl?: string | null;
};

type ProfileView = {
  id: string;
  academicRecords: AcademicRecord[];
};

const LEVELS = ["SSC", "HSC", "DIPLOMA", "BACHELOR", "MASTER", "PHD", "OTHER"] as const;

export function AcademicRecordsSection({ profile }: { profile: ProfileView }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const form = useForm({
    resolver: zodResolver(academicRecordCreateSchema as never) as never,
    defaultValues: {
      level: "SSC",
      institution: "",
      group: "",
      subject: "",
      result: "",
      passingYear: undefined,
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      level: "SSC",
      institution: "",
      group: "",
      subject: "",
      result: "",
      passingYear: undefined,
    });
    setSheetOpen(true);
  }

  function openEdit(rec: AcademicRecord) {
    setEditing(rec);
    form.reset({
      level: (rec.level as (typeof LEVELS)[number]) ?? "SSC",
      institution: rec.institution ?? "",
      group: rec.group ?? "",
      subject: rec.subject ?? "",
      result: rec.result ?? "",
      passingYear: rec.passingYear ?? undefined,
    } as Record<string, unknown>);
    setSheetOpen(true);
  }

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) return;
    const values = form.getValues();
    setSaving(true);
    try {
      if (editing) {
        const patched = academicRecordUpdateSchema.parse(values);
        const updated = await apiFetch<AcademicRecord>(
          `/api/student/profile/academic-records/${editing.id}`,
          { method: "PATCH", json: patched }
        );
        // Optimistically update the cache
        qc.setQueryData<ProfileView>(["student-profile"], (prev) =>
          prev
            ? {
                ...prev,
                academicRecords: prev.academicRecords.map((r) =>
                  r.id === editing.id ? updated : r
                ),
              }
            : prev
        );
        toast({ title: "Record updated", variant: "success" });
      } else {
        const created = await apiFetch<AcademicRecord>(
          "/api/student/profile/academic-records",
          { method: "POST", json: values }
        );
        qc.setQueryData<ProfileView>(["student-profile"], (prev) =>
          prev ? { ...prev, academicRecords: [created, ...prev.academicRecords] } : prev
        );
        toast({ title: "Record added", variant: "success" });
      }
      setSheetOpen(false);
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this academic record?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/student/profile/academic-records/${id}`, { method: "DELETE" });
      qc.setQueryData<ProfileView>(["student-profile"], (prev) =>
        prev
          ? { ...prev, academicRecords: prev.academicRecords.filter((r) => r.id !== id) }
          : prev
      );
      toast({ title: "Record deleted", variant: "success" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <MobileCard className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Academic Information</h2>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden /> Add
        </Button>
      </div>

      {profile.academicRecords.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          No academic records yet. Add your SSC, HSC, or higher education details.
        </p>
      ) : (
        <ul className="space-y-2">
          {profile.academicRecords.map((rec) => (
            <li
              key={rec.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="info">{rec.level}</Badge>
                  {rec.passingYear && (
                    <span className="text-xs text-muted-foreground">{rec.passingYear}</span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-medium">{rec.institution}</p>
                {(rec.subject || rec.group) && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {rec.subject || rec.group}
                  </p>
                )}
                {rec.result && (
                  <p className="mt-0.5 text-xs text-muted-foreground">GPA/Grade: {rec.result}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => openEdit(rec)}
                  aria-label="Edit"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(rec.id)}
                  disabled={deleting === rec.id}
                  aria-label="Delete"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? "Edit Academic Record" : "Add Academic Record"}
        description="Your school, college, or university education."
        onSave={handleSave}
        saving={saving}
        saveLabel={editing ? "Update" : "Add"}
      >
        <div className="space-y-4">
          <Field label="Education Level" required>
            <Select {...form.register("level")} aria-label="Education level">
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Institution" required error={form.formState.errors.institution?.message as string}>
            <Input
              {...form.register("institution")}
              placeholder="e.g. Dhaka College"
              autoComplete="organization"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Group" hint="e.g. Science">
              <Input {...form.register("group")} placeholder="Science" />
            </Field>
            <Field label="Subject" hint="Optional">
              <Input {...form.register("subject")} placeholder="Major" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Passing Year" hint="e.g. 2024">
              <Input
                type="number"
                {...form.register("passingYear", { setValueAs: (v) => v ? Number(v) : undefined })}
                placeholder="2024"
                inputMode="numeric"
              />
            </Field>
            <Field label="GPA / Grade" hint="e.g. 5.00 / A+">
              <Input {...form.register("result")} placeholder="5.00" />
            </Field>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Label className="mb-1 block">Certificate</Label>
            Certificate upload will be available through the Documents module.
          </div>
        </div>
      </ProfileSheet>
    </MobileCard>
  );
}
