"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import type { AuthError } from "@supabase/auth-js";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useNavigationProgress } from "@/hooks/useNavigationProgress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  registerSchema,
  type RegisterValues
} from "@/lib/validators/auth";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { startNavigation } = useNavigationProgress();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    defaultValues: {
      confirm_password: "",
      email: "",
      full_name: "",
      password: ""
    },
    resolver: zodResolver(registerSchema)
  });

  function isRateLimited(error: AuthError | null) {
    const message = error?.message.toLowerCase() ?? "";

    return (
      error?.status === 429 ||
      message.includes("too many requests") ||
      message.includes("rate limit")
    );
  }

  async function onSubmit(values: RegisterValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      options: {
        data: {
          full_name: values.full_name
        }
      },
      password: values.password
    });

    const emailAlreadyExists =
      Boolean(error?.message.toLowerCase().includes("already")) ||
      data.user?.identities?.length === 0;

    if (emailAlreadyExists) {
      setErrorMessage("An account with this email already exists.");
      return;
    }

    if (isRateLimited(error)) {
      setErrorMessage(
        "Too many signup attempts were sent to Supabase. Wait a minute and try again. If this keeps happening, increase the Auth email limits or configure custom SMTP."
      );
      return;
    }

    if (error || !data.user) {
      setErrorMessage("Unable to create your account.");
      return;
    }

    if (!data.session) {
      form.reset();
      setSuccessMessage(
        "Check your email to confirm your account, then sign in to finish setup."
      );
      return;
    }

    const profileResponse = await fetch("/api/auth/bootstrap-profile", {
      body: JSON.stringify({ full_name: values.full_name }),
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!profileResponse.ok) {
      await supabase.auth.signOut().catch(() => null);
      setErrorMessage("Unable to create your account.");
      return;
    }

    startNavigation();
    router.replace("/dashboard");
  }

  const bankName = process.env.NEXT_PUBLIC_BANK_NAME || "Community Bank";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A2540] px-6 py-12">
      <Card className="w-full max-w-md border-white/10 bg-white shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#0A2540]">
            {bankName}
          </p>
          <div className="space-y-2">
            <CardTitle>Register</CardTitle>
            <CardDescription>
              Open your customer account with a few quick details.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" {...form.register("full_name")} />
              {form.formState.errors.full_name ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.full_name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                placeholder="you@example.com"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  autoComplete="new-password"
                  className="pr-12"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...form.register("password")}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm password</Label>
              <div className="relative">
                <Input
                  autoComplete="new-password"
                  className="pr-12"
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  {...form.register("confirm_password")}
                />
                <button
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                  type="button"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.confirm_password ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.confirm_password.message}
                </p>
              ) : null}
            </div>

            {errorMessage ? (
              <Alert className="border-red-200 bg-red-50 text-red-900">
                {errorMessage}
              </Alert>
            ) : null}

            {successMessage ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                {successMessage}
              </Alert>
            ) : null}

            <Button
              className="w-full"
              disabled={form.formState.isSubmitting}
              type="submit"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link className="font-semibold text-[#0A2540]" href="/login">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
