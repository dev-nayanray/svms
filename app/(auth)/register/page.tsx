"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@/lib/validations/auth";
import { Button, Input, Label } from "@/components/ui";
import Link from "next/link";
import {
  Eye, EyeOff, Loader2, AlertCircle, CheckCircle2,
  ArrowRight, ShieldCheck,
} from "lucide-react";
import { pushRoleHome } from "@/app/(auth)/login/login-form";

type FormValues = { name: string; email: string; phone?: string; password: string };

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Registration failed. Please try again.");
      return;
    }
    await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    await pushRoleHome(router);
    router.refresh();
  };

  function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    signIn("google", { callbackUrl: "/auth/callback" }).catch(() => {
      setGoogleLoading(false);
      setError("Google sign-in failed. Please try again.");
    });
  }

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isLoading = isSubmitting || googleLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* ── Header ── */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Start your journey toward studying in Europe.
        </p>
      </div>

      {/* ── Google Sign-In ── */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card text-sm font-medium transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50"
      >
        {googleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        )}
        Continue with Google
      </button>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">OR</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ── Name ── */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="John Doe"
          className="h-11 rounded-xl"
          {...register("name")}
        />
        {errors.name && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {errors.name.message}
          </p>
        )}
      </div>

      {/* ── Email ── */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11 rounded-xl"
          {...register("email")}
        />
        {errors.email && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {errors.email.message}
          </p>
        )}
      </div>

      {/* ── Phone ── */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+880 1XXX-XXXXXX"
          className="h-11 rounded-xl"
          {...register("phone")}
        />
      </div>

      {/* ── Password ── */}
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a strong password"
            className="h-11 rounded-xl pr-10"
            {...register("password", {
              onChange: (e) => setPassword(e.target.value),
            })}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {errors.password.message}
          </p>
        )}
        {/* Password strength */}
        {password.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className={`flex items-center gap-0.5 transition-colors ${hasLength ? "text-emerald-500" : ""}`}>
              <CheckCircle2 className="h-3 w-3" /> 8+ chars
            </span>
            <span className={`flex items-center gap-0.5 transition-colors ${hasUpper ? "text-emerald-500" : ""}`}>
              <CheckCircle2 className="h-3 w-3" /> Uppercase
            </span>
            <span className={`flex items-center gap-0.5 transition-colors ${hasLower ? "text-emerald-500" : ""}`}>
              <CheckCircle2 className="h-3 w-3" /> Lowercase
            </span>
            <span className={`flex items-center gap-0.5 transition-colors ${hasNumber ? "text-emerald-500" : ""}`}>
              <CheckCircle2 className="h-3 w-3" /> Number
            </span>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Submit ── */}
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={isLoading}>
        {isSubmitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
        ) : (
          <>Create account <ArrowRight className="h-4 w-4" /></>
        )}
      </Button>

      {/* ── Trust indicator ── */}
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        Secure registration · Your data is protected
      </p>

      {/* ── Login link ── */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
