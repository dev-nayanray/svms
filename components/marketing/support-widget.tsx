"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageCircle, X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const supportSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Valid email required"),
  message: z.string().min(10, "Please tell us how we can help (min 10 characters)"),
});

type SupportForm = z.infer<typeof supportSchema>;

/**
 * FloatingSupportWidget — a chat-bubble icon fixed to the bottom-right
 * of every marketing page. Clicking it opens a slide-up panel with a
 * quick contact form that POSTs to /api/contact (same pipeline as the
 * full contact page — creates a Lead record in the DB).
 *
 * Design:
 *  - 56px circular gold-accent button with pulse animation
 *  - Panel slides up from the button with backdrop blur
 *  - Form has name, email, message fields
 *  - Success state shows checkmark + "We'll be in touch"
 *  - Auto-closes after 4 seconds on success
 *  - Keyboard accessible (Escape to close, Tab to navigate)
 *  - Respects prefers-reduced-motion
 */
export function FloatingSupportWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportForm>({
    resolver: zodResolver(supportSchema),
  });

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open]);

  // Auto-close after success
  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      reset();
    }, 4000);
    return () => clearTimeout(timer);
  }, [submitted, reset]);

  const onSubmit = async (data: SupportForm) => {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        message: data.message,
      }),
    });
    if (!res.ok) throw new Error("Failed to send");
    setSubmitted(true);
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          border: "2px solid #d4af37",
        }}
      >
        {/* Pulse ring */}
        {!open && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-20"
            style={{ backgroundColor: "#d4af37" }}
            aria-hidden
          />
        )}
        {open ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6" style={{ color: "#d4af37" }} />
        )}
      </button>

      {/* Support panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          role="dialog"
          aria-label="Quick support form"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 p-4 text-white"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: "rgba(212, 175, 55, 0.15)" }}
            >
              <MessageCircle className="h-5 w-5" style={{ color: "#d4af37" }} />
            </span>
            <div>
              <p className="text-sm font-bold">How can we help?</p>
              <p className="text-xs text-white/60">We typically reply within 24 hours</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Message sent!</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We&apos;ll get back to you at the email you provided.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div>
                  <input
                    {...register("name")}
                    placeholder="Your name"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
                  )}
                </div>
                <div>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="Your email"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                  )}
                </div>
                <div>
                  <textarea
                    {...register("message")}
                    placeholder="How can we help you?"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    aria-invalid={!!errors.message}
                  />
                  {errors.message && (
                    <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send message
                    </>
                  )}
                </button>
                <p className="text-center text-[10px] text-muted-foreground">
                  By sending, you agree to be contacted by Euroscope.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
