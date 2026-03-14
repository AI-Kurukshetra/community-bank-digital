"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { formatGBP } from "@/utils/currency";
import { formatDate } from "@/utils/dates";

export function StopPaymentRequestButton({
  amountPence,
  createdAt,
  transactionId
}: {
  amountPence: number;
  createdAt: string;
  transactionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSuccessMessage(null), 3000);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  async function handleSubmit() {
    if (reason.trim().length < 10) {
      setErrorMessage("Enter at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/v1/stop-payment", {
        body: JSON.stringify({
          reason: reason.trim(),
          transaction_id: transactionId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.error || "Unable to submit this request.");
        return;
      }

      setReason("");
      setOpen(false);
      setSuccessMessage("Stop payment request submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {successMessage ? <Toast message={successMessage} /> : null}

      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
        Request stop payment
      </Button>

      <Dialog
        description={
          <div className="space-y-3">
            <p>Amount: {formatGBP(amountPence)}</p>
            <p>Date: {formatDate(createdAt)}</p>
            <p>
              A fee may apply. This does not guarantee the payment stops.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="stop-payment-reason">
                Reason
              </label>
              <textarea
                className="min-h-[110px] w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                id="stop-payment-reason"
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
              {errorMessage ? (
                <p className="text-sm text-red-600">{errorMessage}</p>
              ) : null}
            </div>
          </div>
        }
        footer={
          <>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} onClick={() => void handleSubmit()} type="button">
              {isSubmitting ? "Submitting" : "Confirm"}
            </Button>
          </>
        }
        onOpenChange={setOpen}
        open={open}
        title="Request stop payment"
      />
    </>
  );
}
