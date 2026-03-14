"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { getHomePathForRole } from "@/lib/auth-core";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginValues } from "@/lib/validators/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { writeAuditLog } from "@/utils/audit";

const LOCKOUT_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { startNavigation } = useNavigationProgress();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const form = useForm<LoginValues>({
    defaultValues: {
      email: "",
      password: ""
    },
    resolver: zodResolver(loginSchema)
  });

  function isEmailNotConfirmed(error: AuthError | null) {
    const message = error?.message.toLowerCase() ?? "";

    return (
      error?.code === "email_not_confirmed" ||
      message.includes("email not confirmed")
    );
  }

  useEffect(() => {
    if (!lockoutUntil) {
      setSecondsRemaining(0);
      return;
    }

    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((lockoutUntil - Date.now()) / 1000)
      );

      setSecondsRemaining(remaining);

      if (remaining === 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        window.clearInterval(interval);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lockoutUntil]);

  async function onSubmit(values: LoginValues) {
    if (lockoutUntil && lockoutUntil > Date.now()) {
      return;
    }

    setErrorMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password
    });

    if (isEmailNotConfirmed(error)) {
      setErrorMessage(
        "Confirm your email address from the Supabase signup email, then sign in again."
      );
      return;
    }

    if (error || !data.session?.user) {
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);

      if (nextFailures >= 3) {
        const nextLockoutUntil = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockoutUntil(nextLockoutUntil);
        setSecondsRemaining(LOCKOUT_SECONDS);
      }

      setErrorMessage("Incorrect email or password.");
      await fetch("/api/auth/failed-login", {
        body: JSON.stringify({ email: values.email }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }).catch(() => null);
      return;
    }

    let profile: { id: string; role: "customer" | "staff" | "admin" } | null =
      null;

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", data.session.user.id)
      .maybeSingle();

    if (!profileError && existingProfile) {
      profile = existingProfile;
    }

    if (!profile) {
      const bootstrapResponse = await fetch("/api/auth/bootstrap-profile", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        },
        method: "POST"
      });

      if (bootstrapResponse.ok) {
        profile = (await bootstrapResponse.json()) as {
          id: string;
          role: "customer" | "staff" | "admin";
        };
      }
    }

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setErrorMessage("Unable to load your account.");
      return;
    }

    setFailedAttempts(0);
    setLockoutUntil(null);
    setSecondsRemaining(0);

    await writeAuditLog(supabase, {
      action: "login_success",
      actor_id: profile.id,
      entity_id: profile.id,
      entity_type: "profiles"
    });

    startNavigation();
    router.replace(getHomePathForRole(profile.role));
  }

  const bankName = process.env.NEXT_PUBLIC_BANK_NAME || "Community Bank";
  const isLocked = Boolean(lockoutUntil && lockoutUntil > Date.now());

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A2540] px-6 py-12">
      <Card className="w-full max-w-md border-white/10 bg-white shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#0A2540]">
            {bankName}
          </p>
          <div className="space-y-2">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Access your digital banking dashboard with your email and
              password.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
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
                  autoComplete="current-password"
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

            {errorMessage ? (
              <Alert className="border-red-200 bg-red-50 text-red-900">
                {errorMessage}
              </Alert>
            ) : null}

            {isLocked ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                Too many attempts. Try again in {secondsRemaining}s
              </Alert>
            ) : null}

            <Button
              className="w-full"
              disabled={isLocked || form.formState.isSubmitting}
              type="submit"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in
                </>
              ) : isLocked ? (
                `Try again in ${secondsRemaining}s`
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link className="font-semibold text-[#0A2540]" href="/register">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
