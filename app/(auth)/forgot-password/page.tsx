"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { AuthShell } from "@/components/modules/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues
} from "@/lib/validators/auth";

export default function ForgotPasswordPage() {
  const supabase = getSupabaseBrowserClient();
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<ForgotPasswordValues>({
    defaultValues: {
      email: ""
    },
    resolver: zodResolver(forgotPasswordSchema)
  });

  async function onSubmit(values: ForgotPasswordValues) {
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/login`
    });
    setSubmitted(true);
  }

  return (
    <AuthShell
      description="Enter your email and we will send the reset flow if the account exists."
      footer={
        <div className="text-sm text-muted-foreground">
          <Link className="font-medium text-primary" href="/login">
            Back to sign in
          </Link>
        </div>
      }
      title="Reset your password"
    >
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input id="forgot-email" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-red-600">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        {submitted ? (
          <Alert>
            If that email belongs to an account, a password reset link has been sent.
          </Alert>
        ) : null}

        <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending reset link
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
