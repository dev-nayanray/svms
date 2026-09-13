"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Button, Input, Select, Textarea, Label } from "@/components/ui";
import { SUPPORTED_DESTINATIONS } from "@/lib/constants/app";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your full name").max(120),
  email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .max(40)
    .regex(/^[0-9+()\-\s]*$/, "Phone must contain digits and + - ( ) spaces only")
    .optional()
    .or(z.literal("")),
  destination: z.string().optional(),
  studyLevel: z.enum(["BACHELOR", "MASTER", "PHD", "DIPLOMA", "OTHER"]).optional().or(z.literal("")),
  course: z.string().max(200).optional().or(z.literal("")),
  message: z.string().max(2000, "Message too long (max 2000 characters)").optional().or(z.literal("")),
});

type ContactForm = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      destination: "",
      studyLevel: "" as never,
      course: "",
      message: "",
    },
  });

  const onSubmit = async (values: ContactForm) => {
    try {
      setStatus("idle");
      setErrorMessage("");
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message ?? `Submission failed (${res.status})`);
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  if (status === "success") {
    return (
      <div className="card-elevated flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
          <Check className="h-6 w-6" aria-hidden />
        </span>
        <h3 className="text-lg font-semibold">Thank you — we'll be in touch</h3>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Your consultation request has been received. A member of our team will contact you within
          one business day.
        </p>
        <Button variant="outline" onClick={() => setStatus("idle")} className="mt-2">
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="card-elevated space-y-4 p-6" noValidate>
      {status === "error" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} autoComplete="name" placeholder="Karim Ahmed" />
        </Field>
        <Field label="Email" required error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register("email")} autoComplete="email" placeholder="you@example.com" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" error={form.formState.errors.phone?.message}>
          <Input type="tel" {...form.register("phone")} autoComplete="tel" placeholder="+880 1XXXXXXXXX" />
        </Field>
        <Field label="Preferred destination" error={form.formState.errors.destination?.message}>
          <Select {...form.register("destination")}>
            <option value="">Select…</option>
            {SUPPORTED_DESTINATIONS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Study level" error={form.formState.errors.studyLevel?.message}>
          <Select {...form.register("studyLevel")}>
            <option value="">Select…</option>
            <option value="BACHELOR">Bachelor</option>
            <option value="MASTER">Master</option>
            <option value="PHD">PhD</option>
            <option value="DIPLOMA">Diploma</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Intended course" error={form.formState.errors.course?.message}>
          <Input {...form.register("course")} placeholder="e.g. Computer Science" />
        </Field>
      </div>

      <Field label="Message" error={form.formState.errors.message?.message}>
        <Textarea
          {...form.register("message")}
          rows={4}
          placeholder="Tell us about your study goals, timeline, or any questions you have."
        />
      </Field>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          We respect your privacy. Your information is only used to contact you about your consultation.
        </p>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
            </>
          ) : (
            "Send message"
          )}
        </Button>
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
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
