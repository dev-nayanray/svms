"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Languages } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button, Badge } from "@/components/ui";
import { MobileCard } from "@/components/student/ui";
import { ProfileSheet, Field } from "./profile-sheet";
import { Input, Select } from "@/components/ui";
import { englishProficiencyCreateSchema, englishProficiencyUpdateSchema } from "@/lib/validations";
import { format, parseISO } from "date-fns";

type EnglishProficiency = {
  id: string;
  testType: string;
  overallScore?: number | null;
  readingScore?: number | null;
  writingScore?: number | null;
  listeningScore?: number | null;
  speakingScore?: number | null;
  testDate?: string | Date | null;
  expiryDate?: string | Date | null;
  certificateUrl?: string | null;
};

type ProfileView = {
  id: string;
  englishProficiencies: EnglishProficiency[];
};

const TEST_TYPES = ["IELTS", "TOEFL", "PTE", "DUOLINGO", "OTHER"] as const;

function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

export function EnglishProficiencySection({ profile }: { profile: ProfileView }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EnglishProficiency | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const form = useForm({
    resolver: zodResolver(englishProficiencyCreateSchema as never) as never,
    defaultValues: {
      testType: "IELTS",
      overallScore: undefined,
      readingScore: undefined,
      writingScore: undefined,
      listeningScore: undefined,
      speakingScore: undefined,
      testDate: "",
      expiryDate: "",
    },
  } as Record<string, unknown>);

  function openCreate() {
    setEditing(null);
    form.reset({
      testType: "IELTS",
      overallScore: "",
      readingScore: "",
      writingScore: "",
      listeningScore: "",
      speakingScore: "",
      testDate: "",
      expiryDate: "",
    } as Record<string, unknown>);
    setSheetOpen(true);
  }

  function openEdit(rec: EnglishProficiency) {
    setEditing(rec);
    form.reset({
      testType: rec.testType,
      overallScore: rec.overallScore ?? "",
      readingScore: rec.readingScore ?? "",
      writingScore: rec.writingScore ?? "",
      listeningScore: rec.listeningScore ?? "",
      speakingScore: rec.speakingScore ?? "",
      testDate: rec.testDate ? (typeof rec.testDate === "string" ? rec.testDate.slice(0, 10) : format(rec.testDate, "yyyy-MM-dd")) : "",
      expiryDate: rec.expiryDate ? (typeof rec.expiryDate === "string" ? rec.expiryDate.slice(0, 10) : format(rec.expiryDate, "yyyy-MM-dd")) : "",
    } as Record<string, unknown>);
    setSheetOpen(true);
  }

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) return;
    const raw = form.getValues() as Record<string, unknown>;
    // Normalize empty strings → undefined so Zod treats them as "not provided"
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === "" || v === null) continue;
      if (["overallScore", "readingScore", "writingScore", "listeningScore", "speakingScore"].includes(k)) {
        values[k] = Number(v);
      } else if (["testDate", "expiryDate"].includes(k)) {
        values[k] = new Date(v as string);
      } else {
        values[k] = v;
      }
    }
    setSaving(true);
    try {
      if (editing) {
        const patched = englishProficiencyUpdateSchema.parse(values);
        const updated = await apiFetch<EnglishProficiency>(
          `/api/student/profile/english-proficiencies/${editing.id}`,
          { method: "PATCH", json: patched }
        );
        qc.setQueryData<ProfileView>(["student-profile"], (prev) =>
          prev
            ? {
                ...prev,
                englishProficiencies: prev.englishProficiencies.map((r) =>
                  r.id === editing.id ? updated : r
                ),
              }
            : prev
        );
        toast({ title: "Record updated", variant: "success" });
      } else {
        const created = await apiFetch<EnglishProficiency>(
          "/api/student/profile/english-proficiencies",
          { method: "POST", json: values }
        );
        qc.setQueryData<ProfileView>(["student-profile"], (prev) =>
          prev ? { ...prev, englishProficiencies: [created, ...prev.englishProficiencies] } : prev
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
    if (!confirm("Delete this English test record?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/student/profile/english-proficiencies/${id}`, { method: "DELETE" });
      qc.setQueryData<ProfileView>(["student-profile"], (prev) =>
        prev
          ? { ...prev, englishProficiencies: prev.englishProficiencies.filter((r) => r.id !== id) }
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
          <Languages className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">English Proficiency</h2>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden /> Add
        </Button>
      </div>

      {profile.englishProficiencies.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          No English test records yet. Add your IELTS, TOEFL, PTE, or Duolingo results.
        </p>
      ) : (
        <ul className="space-y-2">
          {profile.englishProficiencies.map((rec) => (
            <li
              key={rec.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="info">{rec.testType}</Badge>
                  {rec.overallScore != null && (
                    <span className="text-sm font-semibold">{rec.overallScore}</span>
                  )}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {rec.readingScore != null && (
                    <span>Reading: <strong className="text-foreground">{rec.readingScore}</strong></span>
                  )}
                  {rec.writingScore != null && (
                    <span>Writing: <strong className="text-foreground">{rec.writingScore}</strong></span>
                  )}
                  {rec.listeningScore != null && (
                    <span>Listening: <strong className="text-foreground">{rec.listeningScore}</strong></span>
                  )}
                  {rec.speakingScore != null && (
                    <span>Speaking: <strong className="text-foreground">{rec.speakingScore}</strong></span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Test: {fmtDate(rec.testDate)}
                  {rec.expiryDate ? ` · Expires: ${fmtDate(rec.expiryDate)}` : ""}
                </p>
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
        title={editing ? "Edit English Test" : "Add English Test"}
        description="IELTS, TOEFL, PTE, Duolingo, or other."
        onSave={handleSave}
        saving={saving}
        saveLabel={editing ? "Update" : "Add"}
      >
        <div className="space-y-4">
          <Field label="Test Type" required>
            <Select {...form.register("testType")} aria-label="Test type">
              {TEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Overall Score" hint="e.g. 7.5 for IELTS, 110 for TOEFL">
            <Input
              type="number"
              step="0.5"
              inputMode="decimal"
              {...form.register("overallScore")}
              placeholder="7.5"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Listening">
              <Input
                type="number"
                step="0.5"
                inputMode="decimal"
                {...form.register("listeningScore")}
                placeholder="8.0"
              />
            </Field>
            <Field label="Reading">
              <Input
                type="number"
                step="0.5"
                inputMode="decimal"
                {...form.register("readingScore")}
                placeholder="7.5"
              />
            </Field>
            <Field label="Writing">
              <Input
                type="number"
                step="0.5"
                inputMode="decimal"
                {...form.register("writingScore")}
                placeholder="7.0"
              />
            </Field>
            <Field label="Speaking">
              <Input
                type="number"
                step="0.5"
                inputMode="decimal"
                {...form.register("speakingScore")}
                placeholder="7.5"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Test Date">
              <Input type="date" {...form.register("testDate")} />
            </Field>
            <Field label="Expiry Date" hint="If applicable">
              <Input type="date" {...form.register("expiryDate")} />
            </Field>
          </div>
        </div>
      </ProfileSheet>
    </MobileCard>
  );
}
