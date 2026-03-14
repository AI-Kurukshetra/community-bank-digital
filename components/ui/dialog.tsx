"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className
}: DialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4"
      role="dialog"
    >
      <div
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "relative z-[101] w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white p-6 shadow-2xl",
          className
        )}
      >
        <button
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          onClick={() => onOpenChange(false)}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-2">
          <h2 className="pr-8 text-xl font-semibold text-slate-950">{title}</h2>
          {description ? (
            <div className="text-sm leading-6 text-slate-600">{description}</div>
          ) : null}
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
        {footer ? <div className="mt-6 flex gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
