"use client";

import { useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import Link from "next/link";
import {
  Mail, ArrowRight, Loader2, CheckCircle2, ArrowLeft,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Simulate API call — the actual email sending is TODO (see DEVELOPMENT.md)
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 800);
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        {/* Success icon */}
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for{" "}
            <span className="font-medium text-foreground">{email || "your email"}</span>,
            we&apos;ve sent instructions to reset your password.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 text-left">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Didn&apos;t receive an email?</strong>
            <br />
            • Check your spam folder
            <br />
            • Make sure you entered the correct email
            <br />
            • The email may take a few minutes to arrive
          </p>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => { setSent(false); setEmail(""); }}
          >
            Try a different email
          </Button>
          <Link href="/login">
            <Button className="h-11 w-full rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll help you reset your password.
        </p>
      </div>

      {/* Email input */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            className="h-11 rounded-xl pl-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      {/* Submit */}
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || !email}>
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
        ) : (
          <>Send reset link <ArrowRight className="h-4 w-4" /></>
        )}
      </Button>

      {/* Back link */}
      <p className="text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
