"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@/lib/validations/auth";
import { Button, Input, Label } from "@/components/ui";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

type FormValues = { name: string; email: string; phone?: string; password: string };

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

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
    router.push("/");
    router.refresh();
  };

  // Password strength indicators
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join Euroscope and start your European study journey today.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="John Doe"
          className="h-11"
          {...register("name")}
        />
        {errors.name && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11"
          {...register("email")}
        />
        {errors.email && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+880 1XXX-XXXXXX"
          className="h-11"
          {...register("phone")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a strong password"
            className="h-11 pr-10"
            {...register("password", {
              onChange: (e) => setPassword(e.target.value),
            })}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
        {/* Password strength indicator */}
        {password.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span className={`flex items-center gap-1 ${hasLength ? "text-success" : ""}`}>
              <CheckCircle2 className="h-3 w-3" /> 8+ chars
            </span>
            <span className={`flex items-center gap-1 ${hasUpper ? "text-success" : ""}`}>
              <CheckCircle2 className="h-3 w-3" /> Uppercase
            </span>
            <span className={`flex items-center gap-1 ${hasLower ? "text-success" : ""}`}>
              <CheckCircle2 className="h-3 w-3" /> Lowercase
            </span>
            <span className={`flex items-center gap-1 ${hasNumber ? "text-success" : ""}`}>
              <CheckCircle2 className="h-3 w-3" /> Number
            </span>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
        ) : (
          "Create account"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
