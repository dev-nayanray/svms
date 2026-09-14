"use client";

import { useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import Link from "next/link";

/**
 * TODO(email-automation): wire to a transactional email provider.
 * Currently the request is accepted but no email is sent — see DEVELOPMENT.md.
 */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Reset your password</h1>
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a reset link will be sent.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required />
          </div>
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
