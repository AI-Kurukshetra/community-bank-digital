import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export function AuthShell({
  children,
  description,
  footer,
  title
}: {
  children: ReactNode;
  description: string;
  footer?: ReactNode;
  title: string;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10 sm:px-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <section className="hidden rounded-[2rem] border border-white/70 bg-primary px-8 py-10 text-primary-foreground shadow-soft lg:block">
          <div className="flex h-full flex-col justify-between gap-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4" />
                Community Bank Digital
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight">
                  Protected digital banking access for customers and staff.
                </h1>
                <p className="max-w-lg text-base leading-7 text-primary-foreground/80">
                  Authentication, role-aware routing, fraud signals, and audit logging are wired into the app shell.
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-primary-foreground/80">
              <p>Customer access routes into the banking workspace.</p>
              <p>Staff and administrators are routed into the operations console.</p>
            </div>
          </div>
        </section>

        <Card className="mx-auto w-full max-w-xl">
          <CardHeader>
            <Link className="text-sm font-medium text-primary" href="/">
              Community Bank Digital
            </Link>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {children}
            {footer}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
