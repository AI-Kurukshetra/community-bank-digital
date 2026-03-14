"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import { CardDisplay } from "@/components/modules/cards/CardDisplay";
import { getTransactionPrefix, getTransactionTone } from "@/lib/banking";
import type { Card as BankCard, Transaction } from "@/types";
import { formatGBP, poundsToPence, penceToPounds } from "@/utils/currency";
import { formatDate } from "@/utils/dates";

type ToastState = {
  message: string;
  tone: "success" | "error";
} | null;

function parseAmountInput(value: string) {
  const trimmed = value.trim();

  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(trimmed)) {
    return null;
  }

  const pounds = Number(trimmed);

  if (!Number.isFinite(pounds) || pounds <= 0) {
    return null;
  }

  return poundsToPence(pounds);
}

export function CardDetailClient({
  card,
  transactions
}: {
  card: BankCard;
  transactions: Transaction[];
}) {
  const router = useRouter();
  const [isLimitEditing, setIsLimitEditing] = useState(false);
  const [limitInput, setLimitInput] = useState(
    penceToPounds(card.daily_limit_pence).toFixed(2)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3000);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function updateCard(payload: {
    daily_limit_pence?: number;
    status?: BankCard["status"];
  }) {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/v1/cards/${card.id}`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Update failed. Please try again.");
      }

      if (payload.status === "frozen") {
        setToast({
          message: "Card frozen successfully.",
          tone: "success"
        });
      } else if (payload.status === "active") {
        setToast({
          message: "Card unfrozen. You can use your card again.",
          tone: "success"
        });
      } else if (payload.status === "cancelled") {
        setToast({
          message: "Card cancelled successfully.",
          tone: "success"
        });
      } else {
        setToast({
          message: "Daily limit updated successfully.",
          tone: "success"
        });
      }

      setFreezeDialogOpen(false);
      setCancelDialogOpen(false);
      setIsLimitEditing(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Update failed. Please try again.";

      setErrorMessage(message);
      setToast({
        message,
        tone: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <BackButton fallbackHref="/cards" label="Back to cards" />

      <CardDisplay card={card} size="lg" />

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Freeze, unfreeze, cancel, or change the daily spend limit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {errorMessage ? (
            <Alert className="border-red-200 bg-red-50 text-red-900">
              {errorMessage}
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {card.status === "active" ? (
              <Button
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => setFreezeDialogOpen(true)}
                type="button"
                variant="outline"
              >
                Freeze Card
              </Button>
            ) : null}

            {card.status === "frozen" ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmitting}
                onClick={() => void updateCard({ status: "active" })}
                type="button"
              >
                Unfreeze Card
              </Button>
            ) : null}

            {card.status === "active" || card.status === "frozen" ? (
              <Button
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => setCancelDialogOpen(true)}
                type="button"
                variant="outline"
              >
                Report Lost or Stolen
              </Button>
            ) : null}
          </div>

          {card.status === "active" || card.status === "frozen" ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700">
                  Daily limit:{" "}
                  <span className="font-semibold text-slate-950">
                    {formatGBP(card.daily_limit_pence)}
                  </span>
                </p>
                <Button
                  onClick={() => setIsLimitEditing((current) => !current)}
                  type="button"
                  variant="outline"
                >
                  Change limit
                </Button>
              </div>

              {isLimitEditing ? (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="limit">New daily limit</Label>
                    <div className="flex items-center rounded-2xl border border-border bg-white/90 px-4">
                      <span className="text-sm font-medium text-slate-500">GBP</span>
                      <Input
                        className="border-0 bg-transparent px-3 shadow-none focus-visible:ring-0"
                        id="limit"
                        onChange={(event) => setLimitInput(event.target.value)}
                        placeholder="0.00"
                        value={limitInput}
                      />
                    </div>
                  </div>
                  <Button
                    disabled={isSubmitting}
                    onClick={() => {
                      const nextLimit = parseAmountInput(limitInput);

                      if (!nextLimit || nextLimit > 50000) {
                        setErrorMessage(
                          `Enter a daily limit up to ${formatGBP(50000)}.`
                        );
                        return;
                      }

                      void updateCard({ daily_limit_pence: nextLimit });
                    }}
                    type="button"
                  >
                    Save
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>
            The latest activity on this card&apos;s account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <div
                className="flex flex-col gap-4 rounded-2xl border border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between"
                key={transaction.id}
              >
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">
                    {formatDate(transaction.created_at)}
                  </p>
                  <p className="font-medium text-slate-950">
                    {transaction.description ??
                      transaction.merchant ??
                      "Transaction"}
                  </p>
                  <Badge className="bg-slate-100 text-slate-600">
                    {transaction.category.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p
                  className={`text-sm font-semibold ${getTransactionTone(transaction.direction)}`}
                >
                  {getTransactionPrefix(transaction.direction)}
                  {formatGBP(transaction.amount_pence)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No recent transactions are available for this card.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        description="Your card will be blocked for new purchases. Direct debits will continue as normal. You can unfreeze at any time."
        footer={
          <>
            <Button
              onClick={() => setFreezeDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => void updateCard({ status: "frozen" })}
              type="button"
            >
              Freeze Card
            </Button>
          </>
        }
        onOpenChange={setFreezeDialogOpen}
        open={freezeDialogOpen}
        title="Freeze this card?"
      />

      <Dialog
        description="This permanently cancels the card. This cannot be undone. Contact your branch to request a replacement card."
        footer={
          <>
            <Button
              onClick={() => setCancelDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Go back
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => void updateCard({ status: "cancelled" })}
              type="button"
            >
              Cancel Card
            </Button>
          </>
        }
        onOpenChange={setCancelDialogOpen}
        open={cancelDialogOpen}
        title="Cancel this card?"
      />
    </div>
  );
}
