"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { getAccountTypeLabel } from "@/lib/banking";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Account, BillFrequency, BillPayment } from "@/types";
import { formatGBP, poundsToPence, penceToPounds } from "@/utils/currency";
import { formatDate } from "@/utils/dates";
import { maskAccountNumber } from "@/utils/maskAccount";

type ScreenState = "form" | "review" | "success";

type NewPayeeForm = {
  amount: string;
  frequency: BillFrequency;
  payee_name: string;
  reference: string;
};

type BillPaymentSuccessSummary = {
  amountPence: number;
  payeeName: string;
  paymentDate: string;
};

const NEW_PAYEE_VALUE = "__new__";

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

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

function getAccountOptionLabel(account: Account) {
  return `${getAccountTypeLabel(account.type)} ${maskAccountNumber(
    account.account_number
  )} - ${formatGBP(account.balance_pence)}`;
}

export function BillPayClient() {
  const supabase = getSupabaseBrowserClient();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [billPayments, setBillPayments] = useState<BillPayment[]>([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [billPaymentId, setBillPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDate());
  const [reference, setReference] = useState("");
  const [screen, setScreen] = useState<ScreenState>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPayeeForm, setShowNewPayeeForm] = useState(false);
  const [isSavingPayee, setIsSavingPayee] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [editingDate, setEditingDate] = useState(getTodayDate());
  const [cancelTarget, setCancelTarget] = useState<BillPayment | null>(null);
  const [successSummary, setSuccessSummary] =
    useState<BillPaymentSuccessSummary | null>(null);
  const [newPayee, setNewPayee] = useState<NewPayeeForm>({
    amount: "",
    frequency: "one_off",
    payee_name: "",
    reference: ""
  });

  const activeBillPayments = billPayments.filter((payment) => payment.is_active);
  const selectedBillPayment =
    activeBillPayments.find((payment) => payment.id === billPaymentId) ?? null;
  const selectedAccount =
    accounts.find((account) => account.id === fromAccountId) ?? null;
  const reviewAmountPence = parseAmountInput(amount);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const [accountsResult, billPaymentsResult] = await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("bill_payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    ]);

    const nextAccounts = (accountsResult.data ?? []) as Account[];
    const nextBillPayments = (billPaymentsResult.data ?? []) as BillPayment[];

    setAccounts(nextAccounts);
    setBillPayments(nextBillPayments);
    setFromAccountId((current) => current || nextAccounts[0]?.id || "");
    setBillPaymentId(
      (current) =>
        current || nextBillPayments.find((payment) => payment.is_active)?.id || ""
    );
    setIsLoading(false);
  }, [supabase, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedBillPayment) {
      setAmount(penceToPounds(selectedBillPayment.amount_pence).toFixed(2));
    }
  }, [selectedBillPayment]);

  function validateForm() {
    if (!selectedAccount) {
      return "Select the account you want to pay from.";
    }

    if (!selectedBillPayment) {
      return "Select who you want to pay.";
    }

    if (!reviewAmountPence) {
      return "Enter a valid amount with up to 2 decimal places.";
    }

    if (paymentDate < getTodayDate()) {
      return "Payment date cannot be in the past.";
    }

    return null;
  }

  async function handleSavePayee() {
    if (!user?.id) {
      return;
    }

    if (newPayee.payee_name.trim().length < 2) {
      setErrorMessage("Enter the payee name.");
      return;
    }

    const nextAmountPence = parseAmountInput(newPayee.amount);

    if (!nextAmountPence) {
      setErrorMessage("Enter a valid payee amount.");
      return;
    }

    setIsSavingPayee(true);

    const { data, error } = await supabase
      .from("bill_payments")
      .insert({
        amount_pence: nextAmountPence,
        frequency: newPayee.frequency,
        is_active: true,
        next_payment_date: paymentDate,
        payee_name: newPayee.payee_name.trim(),
        reference: newPayee.reference.trim() || null,
        user_id: user.id
      })
      .select("*")
      .single();

    setIsSavingPayee(false);

    if (error || !data) {
      setErrorMessage("Unable to save this payee right now.");
      return;
    }

    const savedPayment = data as BillPayment;
    setBillPayments((current) => [savedPayment, ...current]);
    setBillPaymentId(savedPayment.id);
    setAmount(penceToPounds(savedPayment.amount_pence).toFixed(2));
    setShowNewPayeeForm(false);
    setNewPayee({
      amount: "",
      frequency: "one_off",
      payee_name: "",
      reference: ""
    });
    setErrorMessage(null);
  }

  async function handleConfirmPayment() {
    if (!reviewAmountPence || !selectedBillPayment || !selectedAccount) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/v1/bill-pay", {
        body: JSON.stringify({
          amount_pence: reviewAmountPence,
          bill_payment_id: selectedBillPayment.id,
          from_account_id: selectedAccount.id,
          payment_date: paymentDate,
          reference: reference.trim() || undefined
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
        throw new Error(payload.error || "Payment failed. Please try again.");
      }

      setSuccessSummary({
        amountPence: reviewAmountPence,
        payeeName: selectedBillPayment.payee_name,
        paymentDate
      });
      setScreen("success");
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Payment failed. Please try again."
      );
      setScreen("form");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveEdit(paymentId: string) {
    const nextAmountPence = parseAmountInput(editingAmount);

    if (!nextAmountPence || !editingDate) {
      setErrorMessage("Enter a valid amount and next payment date.");
      return;
    }

    const { data, error } = await supabase
      .from("bill_payments")
      .update({
        amount_pence: nextAmountPence,
        next_payment_date: editingDate
      })
      .eq("id", paymentId)
      .select("*")
      .single();

    if (error || !data) {
      setErrorMessage("Unable to update this scheduled payment.");
      return;
    }

    const updatedPayment = data as BillPayment;
    setBillPayments((current) =>
      current.map((payment) =>
        payment.id === updatedPayment.id ? updatedPayment : payment
      )
    );
    setEditingPaymentId(null);
    setErrorMessage(null);
  }

  async function handleCancelPayment() {
    if (!cancelTarget) {
      return;
    }

    const { data, error } = await supabase
      .from("bill_payments")
      .update({ is_active: false })
      .eq("id", cancelTarget.id)
      .select("*")
      .single();

    if (error || !data) {
      setErrorMessage("Unable to cancel this payment.");
      return;
    }

    const updatedPayment = data as BillPayment;
    setBillPayments((current) =>
      current.map((payment) =>
        payment.id === updatedPayment.id ? updatedPayment : payment
      )
    );
    setCancelTarget(null);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-slate-500">Loading bill payments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Pay a bill</CardTitle>
            <CardDescription>
              Pay an existing bill or save a new payee for later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {errorMessage ? (
              <Alert className="border-red-200 bg-red-50 text-red-900">
                {errorMessage}
              </Alert>
            ) : null}

            {screen === "form" ? (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="from_account">From account</Label>
                    <Select
                      id="from_account"
                      onChange={(event) => setFromAccountId(event.target.value)}
                      value={fromAccountId}
                    >
                      <option value="">Select an account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {getAccountOptionLabel(account)}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bill_payment">Pay to</Label>
                    <Select
                      id="bill_payment"
                      onChange={(event) => {
                        const value = event.target.value;
                        setBillPaymentId(value === NEW_PAYEE_VALUE ? "" : value);
                        setShowNewPayeeForm(value === NEW_PAYEE_VALUE);
                      }}
                      value={showNewPayeeForm ? NEW_PAYEE_VALUE : billPaymentId}
                    >
                      <option value="">Select a payee</option>
                      {activeBillPayments.map((payment) => (
                        <option key={payment.id} value={payment.id}>
                          {payment.payee_name}
                        </option>
                      ))}
                      <option value={NEW_PAYEE_VALUE}>+ Add new payee</option>
                    </Select>
                  </div>
                </div>

                {showNewPayeeForm ? (
                  <div className="grid gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new_payee_name">Payee name</Label>
                      <Input
                        id="new_payee_name"
                        onChange={(event) =>
                          setNewPayee((current) => ({
                            ...current,
                            payee_name: event.target.value
                          }))
                        }
                        value={newPayee.payee_name}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new_payee_reference">Reference</Label>
                      <Input
                        id="new_payee_reference"
                        onChange={(event) =>
                          setNewPayee((current) => ({
                            ...current,
                            reference: event.target.value
                          }))
                        }
                        value={newPayee.reference}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new_payee_amount">Amount</Label>
                      <div className="flex items-center rounded-2xl border border-border bg-white/90 px-4">
                        <span className="text-sm font-medium text-slate-500">GBP</span>
                        <Input
                          className="border-0 bg-transparent px-3 shadow-none focus-visible:ring-0"
                          id="new_payee_amount"
                          onChange={(event) =>
                            setNewPayee((current) => ({
                              ...current,
                              amount: event.target.value
                            }))
                          }
                          placeholder="0.00"
                          value={newPayee.amount}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["one_off", "monthly", "weekly"] as const).map((value) => (
                          <Button
                            key={value}
                            onClick={() =>
                              setNewPayee((current) => ({
                                ...current,
                                frequency: value
                              }))
                            }
                            type="button"
                            variant={
                              newPayee.frequency === value ? "default" : "outline"
                            }
                          >
                            {value === "one_off"
                              ? "One-off"
                              : value === "monthly"
                                ? "Monthly"
                                : "Weekly"}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <Button
                        disabled={isSavingPayee}
                        onClick={() => void handleSavePayee()}
                        type="button"
                        variant="outline"
                      >
                        {isSavingPayee ? "Saving payee" : "Save payee"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-5 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <div className="flex items-center rounded-2xl border border-border bg-white/90 px-4">
                      <span className="text-sm font-medium text-slate-500">GBP</span>
                      <Input
                        className="border-0 bg-transparent px-3 shadow-none focus-visible:ring-0"
                        id="amount"
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="0.00"
                        value={amount}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_date">Payment date</Label>
                    <Input
                      id="payment_date"
                      min={getTodayDate()}
                      onChange={(event) => setPaymentDate(event.target.value)}
                      type="date"
                      value={paymentDate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reference">Reference</Label>
                    <Input
                      id="reference"
                      onChange={(event) => setReference(event.target.value)}
                      value={reference}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    const validationError = validateForm();

                    if (validationError) {
                      setErrorMessage(validationError);
                      return;
                    }

                    setErrorMessage(null);
                    setScreen("review");
                  }}
                  type="button"
                >
                  Review Payment
                </Button>
              </>
            ) : null}

            {screen === "review" &&
            selectedAccount &&
            selectedBillPayment &&
            reviewAmountPence ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-950">
                    Review payment
                  </h3>
                  <p className="text-sm text-slate-500">
                    Check the payment details before continuing.
                  </p>
                </div>

                <dl className="grid gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-slate-500">From</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {getAccountTypeLabel(selectedAccount.type)}{" "}
                      {maskAccountNumber(selectedAccount.account_number)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">To</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {selectedBillPayment.payee_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Amount</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {formatGBP(reviewAmountPence)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Date</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {formatDate(paymentDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Frequency</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {selectedBillPayment.frequency.replace("_", "-")}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => setScreen("form")}
                    type="button"
                    variant="outline"
                  >
                    Go back
                  </Button>
                  <Button
                    disabled={isSubmitting}
                    onClick={() => void handleConfirmPayment()}
                    type="button"
                  >
                    {isSubmitting ? "Confirming payment" : "Confirm Payment"}
                  </Button>
                </div>
              </div>
            ) : null}

            {screen === "success" && successSummary ? (
              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-semibold text-slate-950">
                  Payment confirmed
                </h3>
                <p className="text-sm text-slate-500">
                  {formatGBP(successSummary.amountPence)} to{" "}
                  {successSummary.payeeName} on {formatDate(successSummary.paymentDate)}
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={() => {
                      setScreen("form");
                      setReference("");
                      setSuccessSummary(null);
                    }}
                    type="button"
                    variant="outline"
                  >
                    Make another payment
                  </Button>
                  <Button asChild>
                    <Link href="/dashboard">Back to dashboard</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Scheduled payments</CardTitle>
            <CardDescription>
              Active bill payments saved on your customer profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeBillPayments.length > 0 ? (
              activeBillPayments.map((payment) => (
                <div
                  className="rounded-2xl border border-slate-100 px-4 py-4"
                  key={payment.id}
                >
                  {editingPaymentId === payment.id ? (
                    <div className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
                      <div>
                        <p className="font-medium text-slate-950">
                          {payment.payee_name}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`amount-${payment.id}`}>Amount</Label>
                        <Input
                          id={`amount-${payment.id}`}
                          onChange={(event) => setEditingAmount(event.target.value)}
                          value={editingAmount}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`date-${payment.id}`}>Next payment</Label>
                        <Input
                          id={`date-${payment.id}`}
                          min={getTodayDate()}
                          onChange={(event) => setEditingDate(event.target.value)}
                          type="date"
                          value={editingDate}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => void handleSaveEdit(payment.id)}
                          type="button"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={() => setEditingPaymentId(null)}
                          type="button"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-[1.2fr_160px_140px_180px_auto] md:items-center">
                      <div>
                        <p className="font-medium text-slate-950">{payment.payee_name}</p>
                      </div>
                      <p className="text-sm font-medium text-slate-950">
                        {formatGBP(payment.amount_pence)}
                      </p>
                      <Badge className="bg-slate-100 text-slate-600">
                        {payment.frequency.replace("_", "-")}
                      </Badge>
                      <p className="text-sm text-slate-500">
                        {payment.frequency === "one_off"
                          ? "One-off"
                          : payment.next_payment_date
                            ? formatDate(payment.next_payment_date)
                            : "One-off"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setEditingPaymentId(payment.id);
                            setEditingAmount(
                              penceToPounds(payment.amount_pence).toFixed(2)
                            );
                            setEditingDate(payment.next_payment_date || getTodayDate());
                          }}
                          type="button"
                          variant="outline"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => setCancelTarget(payment)}
                          type="button"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No active scheduled payments are available yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog
        description={
          cancelTarget ? `Cancel payment to ${cancelTarget.payee_name}?` : undefined
        }
        footer={
          <>
            <Button
              onClick={() => setCancelTarget(null)}
              type="button"
              variant="outline"
            >
              Go back
            </Button>
            <Button onClick={() => void handleCancelPayment()} type="button">
              Cancel payment
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
          }
        }}
        open={Boolean(cancelTarget)}
        title="Cancel this payment?"
      />
    </div>
  );
}
