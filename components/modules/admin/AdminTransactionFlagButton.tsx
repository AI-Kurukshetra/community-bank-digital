"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AdminTransactionFlagButton({
  customerId,
  initialFlagged,
  transactionId
}: {
  customerId: string;
  initialFlagged: boolean;
  transactionId: string;
}) {
  const router = useRouter();
  const [isFlagged, setIsFlagged] = useState(initialFlagged);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFlag() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/v1/admin/transactions/${transactionId}/flag`, {
        body: JSON.stringify({ customer_id: customerId }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to flag this transaction.");
      }

      setIsFlagged(true);
      window.dispatchEvent(new CustomEvent("fraud-alerts-refresh"));
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to flag this transaction."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {isFlagged ? (
        <Badge className="bg-amber-100 text-amber-700">Flagged</Badge>
      ) : (
        <Button
          className="border-red-300 text-red-700 hover:bg-red-50"
          disabled={isSubmitting}
          onClick={() => void handleFlag()}
          type="button"
          variant="outline"
        >
          {isSubmitting ? "Flagging" : "Flag"}
        </Button>
      )}
      {errorMessage ? (
        <p className="text-xs text-red-600">{errorMessage}</p>
      ) : null}
    </div>
  );
}
