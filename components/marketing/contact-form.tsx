"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your full name").max(80),
  email: z.string().email("Please enter a valid email").max(120),
  phone: z.string().max(40).optional().or(z.literal("")),
  destination: z.string().max(60).optional().or(z.literal("")),
  studyLevel: z.enum(["BACHELOR", "MASTER", "PHD", "OTHER"]).optional(),
  course: z.string().max(120).optional().or(z.literal("")),
  message: z.string().min(10, "Please tell us a bit about your plans").max(2000),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const STUDY_LEVELS = [
  { value: "", label: "Select level" },
  { value: "BACHELOR", label: "Bachelor" },
  { value: "MASTER", label: "Master" },
  { value: "PHD", label: "PhD" },
  { value: "OTHER", label: "Other" },
] as const;

const DESTINATIONS = [
  "Germany", "France", "Italy", "Spain", "Netherlands",
  "Sweden", "Finland", "Denmark", "Ireland", "Poland",
  "Hungary", "Portugal", "Austria", "Belgium", "Czech Republic",
] as const;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      destination: "",
      studyLevel: undefined,
      course: "",
      message: "",
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message ?? "Submission failed");
      }
      setStatus("success");
      reset();
    } catch (err) {
      setStatus("error");
      console.error("[contact] submission failed", err);
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
        <h3 className="mt-4 font-display text-xl font-bold">Thank you!</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ve received your request. One of our counselors will reach out within 24 hours.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8"
      aria-label="Consultation request"
    >
      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Something went wrong. Please try again or email us directly.</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name?.message}>
          <input
            {...register("name")}
            type="text"
            autoComplete="name"
            className={inputClass(!!errors.name)}
            placeholder="Your name"
          />
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            className={inputClass(!!errors.email)}
            placeholder="you@example.com"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone (optional)" error={errors.phone?.message}>
          <input
            {...register("phone")}
            type="tel"
            autoComplete="tel"
            className={inputClass(!!errors.phone)}
            placeholder="+8801XXXXXXXXX"
          />
        </Field>
        <Field label="Preferred destination" error={errors.destination?.message}>
          <select {...register("destination")} className={inputClass(false)} defaultValue="">
            <option value="">Select country</option>
            {DESTINATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Study level" error={errors.studyLevel?.message}>
          <select {...register("studyLevel")} className={inputClass(false)} defaultValue="">
            {STUDY_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Intended course (optional)" error={errors.course?.message}>
          <input
            {...register("course")}
            type="text"
            className={inputClass(false)}
            placeholder="e.g. MSc Computer Science"
          />
        </Field>
      </div>

      <Field label="Message" required error={errors.message?.message}>
        <textarea
          {...register("message")}
          rows={4}
          className={cn(inputClass(!!errors.message), "resize-y")}
          placeholder="Tell us about your study plans, current status and what you need help with."
        />
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          We&apos;ll respond within 24 hours.
        </p>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover hover:shadow-md disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            "Send request"
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    "h-11 w-full rounded-lg border bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
    hasError ? "border-destructive" : "border-border focus:border-primary",
  );
}
