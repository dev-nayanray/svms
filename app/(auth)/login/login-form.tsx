"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validations/auth";
import { Button, Input, Label } from "@/components/ui";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

type FormValues = { email: string; password: string };

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: params.get("email") ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    const res = await signIn("credentials", { ...values, redirect: false });
    if (res?.error) {
      setError("Invalid email or password. Please try again.");
      return;
    }
    const callbackUrl = params.get("callbackUrl");
    if (callbackUrl && callbackUrl !== "/") {
      router.push(callbackUrl);
    } else {
      router.push("/");
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your Euroscope account to continue.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            className="h-11 pr-10"
            {...register("password")}
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
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
        ) : (
          "Sign in"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
