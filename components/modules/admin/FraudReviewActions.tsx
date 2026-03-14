"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatAdminStatusLabel,
  getFraudStatusBadgeClass
} from "@/lib/admin";
import type { FraudStatus } from "@/types";

type ReviewedStatus = Exclude<FraudStatus, "flagged">;

export function FraudReviewActions({
  fraudEventId,
  initialStatus,
  onReviewed,
  variant = "inline"
}: {
  fraudEventId: string;
  initialStatus: FraudStatus;
  onReviewed?: (status: ReviewedStatus) => void;
  variant?: "inline" | "stack";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
    setResultMessage(null);
  }, [initialStatus]);

  async function handleReview(action: "confirm" | "dismiss") {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/v1/fraud/${fraudEventId}`, {
        body: JSON.stringify({ action }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Action failed. Please try again.");
      }

      const nextStatus: ReviewedStatus =
        action === "confirm" ? "confirmed" : "dismissed";

      setStatus(nextStatus);
      setResultMessage(
        payload.message ||
          (action === "confirm"
            ? "Fraud confirmed."
            : "Fraud alert dismissed.")
      );
      onReviewed?.(nextStatus);
      window.dispatchEvent(new CustomEvent("fraud-alerts-refresh"));
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Action failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status !== "flagged") {
    return (
      <div className="space-y-2">
        <Badge className={getFraudStatusBadgeClass(status)}>
          {formatAdminStatusLabel(status)}
        </Badge>
        {resultMessage ? (
          <p className="text-xs text-slate-500">{resultMessage}</p>
        ) : null}
        {errorMessage ? (
          <p className="text-xs text-red-600">{errorMessage}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={
        variant === "stack" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
      }
    >
      <Button
        className="bg-red-600 hover:bg-red-700"
        disabled={isSubmitting}
        onClick={() => void handleReview("confirm")}
        type="button"
      >
        Confirm Fraud
      </Button>
      <Button
        disabled={isSubmitting}
        onClick={() => void handleReview("dismiss")}
        type="button"
        variant="outline"
      >
        Dismiss
      </Button>
      {errorMessage ? (
        <p className="w-full text-xs text-red-600">{errorMessage}</p>
      ) : null}
      {resultMessage ? (
        <p className="w-full text-xs text-slate-500">{resultMessage}</p>
      ) : null}
    </div>
  );
}
