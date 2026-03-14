"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastProps = {
  message: string;
  tone?: "success" | "error";
};

export function Toast({ message, tone = "success" }: ToastProps) {
  const isSuccess = tone === "success";
  const Icon = isSuccess ? CheckCircle2 : CircleAlert;

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-[110] flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl",
        isSuccess ? "bg-emerald-600" : "bg-red-600"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
