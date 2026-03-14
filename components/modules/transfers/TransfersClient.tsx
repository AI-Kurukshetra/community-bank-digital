"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  getAccountTypeLabel,
  getTransactionPrefix,
  getTransactionTone
} from "@/lib/banking";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Account, Beneficiary, Transaction } from "@/types";
import { formatGBP, poundsToPence } from "@/utils/currency";
import { formatDate } from "@/utils/dates";
import { maskAccountNumber } from "@/utils/maskAccount";
import {
  validateUKAccountNumber,
  validateUKSortCode
} from "@/utils/validation";

type TransferMode = "own" | "beneficiary";
type ActiveTab = "send" | "history";
type ScreenState = "form" | "review" | "success" | "error";

type NewPayeeForm = {
  account_number: string;
  bank_name: string;
  name: string;
  sort_code: string;
};

type TransferSuccessSummary = {
  amountPence: number;
  toLabel: string;
};

const NEW_PAYEE_VALUE = "__new__";

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

export function TransfersClient() {
  const supabase = getSupabaseBrowserClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("send");
  const [mode, setMode] = useState<TransferMode>("own");
  const [screen, setScreen] = useState<ScreenState>("form");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingPayee, setIsSavingPayee] = useState(false);
  const [showNewPayeeForm, setShowNewPayeeForm] = useState(false);
  const [successReference, setSuccessReference] = useState("");
  const [successSummary, setSuccessSummary] =
    useState<TransferSuccessSummary | null>(null);
  const [newPayee, setNewPayee] = useState<NewPayeeForm>({
    account_number: "",
    bank_name: "",
    name: "",
    sort_code: ""
  });
  const [payeeErrors, setPayeeErrors] = useState<
    Partial<Record<keyof NewPayeeForm, string>>
  >({});

  const fromAccount =
    accounts.find((account) => account.id === fromAccountId) ?? null;
  const availableDestinationAccounts = accounts.filter(
    (account) => account.id !== fromAccountId
  );
  const ownDestinationAccount =
    accounts.find((account) => account.id === toAccountId) ?? null;
  const selectedBeneficiary =
    beneficiaries.find((beneficiary) => beneficiary.id === beneficiaryId) ?? null;

  const transferSummary = useMemo(() => {
    const amountPence = parseAmountInput(amount);

    if (!fromAccount || !amountPence) {
      return null;
    }

    return {
      amountPence,
      fromLabel: `${getAccountTypeLabel(fromAccount.type)} ${maskAccountNumber(
        fromAccount.account_number
      )}`,
      reference: reference.trim() || "None",
      toLabel:
        mode === "own" && ownDestinationAccount
          ? `${getAccountTypeLabel(ownDestinationAccount.type)} ${maskAccountNumber(
              ownDestinationAccount.account_number
            )}`
          : mode === "beneficiary" && selectedBeneficiary
            ? `${selectedBeneficiary.name} ${maskAccountNumber(
                selectedBeneficiary.account_number
              )}`
            : null
    };
  }, [
    amount,
    fromAccount,
    mode,
    ownDestinationAccount,
    reference,
    selectedBeneficiary
  ]);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: accountsData } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const nextAccounts = (accountsData ?? []) as Account[];
    const accountIds = nextAccounts.map((account) => account.id);

    const [beneficiariesResult, historyResult] = await Promise.all([
      supabase
        .from("beneficiaries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      accountIds.length > 0
        ? supabase
            .from("transactions")
            .select("*")
            .in("account_id", accountIds)
            .not("reference", "is", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Transaction[] })
    ]);

    setAccounts(nextAccounts);
    setBeneficiaries((beneficiariesResult.data ?? []) as Beneficiary[]);
    setHistory((historyResult.data ?? []) as Transaction[]);
    setFromAccountId((current) => current || nextAccounts[0]?.id || "");
    setToAccountId((current) => current || nextAccounts[1]?.id || "");
    setIsLoading(false);
  }, [supabase, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!fromAccountId) {
      return;
    }

    if (toAccountId === fromAccountId) {
      setToAccountId(availableDestinationAccounts[0]?.id || "");
    }
  }, [availableDestinationAccounts, fromAccountId, toAccountId]);

  function resetToForm() {
    setErrorMessage(null);
    setScreen("form");
  }

  function validateTransferForm() {
    const amountPence = parseAmountInput(amount);

    if (!fromAccount) {
      return "Select the account you want to transfer from.";
    }

    if (!amountPence) {
      return "Enter a valid amount with up to 2 decimal places.";
    }

    if (reference.trim().length > 18) {
      return "Reference must be 18 characters or fewer.";
    }

    if (mode === "own") {
      if (!ownDestinationAccount) {
        return "Select the destination account.";
      }

      if (ownDestinationAccount.id === fromAccount.id) {
        return "Choose a different destination account.";
      }
    }

    if (mode === "beneficiary" && !selectedBeneficiary) {
      return "Select who you want to pay.";
    }

    return null;
  }

  async function handleReview() {
    const validationError = validateTransferForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setScreen("review");
  }

  async function handleConfirmTransfer() {
    if (!transferSummary) {
      setErrorMessage("Unable to review this transfer.");
      setScreen("form");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/v1/transfers", {
        body: JSON.stringify({
          amount_pence: transferSummary.amountPence,
          beneficiary_id:
            mode === "beneficiary" ? selectedBeneficiary?.id : undefined,
          from_account_id: fromAccountId,
          reference: reference.trim() || undefined,
          to_account_id: mode === "own" ? ownDestinationAccount?.id : undefined
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        reference?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Transfer failed. Please try again.");
      }

      setSuccessSummary({
        amountPence: transferSummary.amountPence,
        toLabel: transferSummary.toLabel || "selected account"
      });
      setSuccessReference(payload.reference ?? "");
      await loadData();
      setScreen("success");
      setAmount("");
      setReference("");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Transfer failed. Please try again."
      );
      setScreen("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function validatePayeeField(field: keyof NewPayeeForm, value: string) {
    if (field === "account_number" && !validateUKAccountNumber(value)) {
      return "Enter an 8-digit account number.";
    }

    if (field === "sort_code" && !validateUKSortCode(value)) {
      return "Enter a valid sort code in XX-XX-XX format.";
    }

    if (field === "name" && value.trim().length < 2) {
      return "Enter the payee name.";
    }

    return null;
  }

  async function handleSavePayee() {
    if (!user?.id) {
      return;
    }

    const nextErrors: Partial<Record<keyof NewPayeeForm, string>> = {};

    (Object.keys(newPayee) as (keyof NewPayeeForm)[]).forEach((field) => {
      if (field === "bank_name") {
        return;
      }

      const fieldError = validatePayeeField(field, newPayee[field]);

      if (fieldError) {
        nextErrors[field] = fieldError;
      }
    });

    setPayeeErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSavingPayee(true);

    const { data, error } = await supabase
      .from("beneficiaries")
      .insert({
        account_number: newPayee.account_number.trim(),
        bank_name: newPayee.bank_name.trim() || null,
        name: newPayee.name.trim(),
        sort_code: newPayee.sort_code.trim(),
        user_id: user.id
      })
      .select("*")
      .single();

    setIsSavingPayee(false);

    if (error || !data) {
      setErrorMessage("Unable to save this payee right now.");
      return;
    }

    const savedPayee = data as Beneficiary;
    setBeneficiaries((current) => [savedPayee, ...current]);
    setBeneficiaryId(savedPayee.id);
    setShowNewPayeeForm(false);
    setNewPayee({
      account_number: "",
      bank_name: "",
      name: "",
      sort_code: ""
    });
    setPayeeErrors({});
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-slate-500">Loading your transfer options...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setActiveTab("send")}
          type="button"
          variant={activeTab === "send" ? "default" : "outline"}
        >
          Send Money
        </Button>
        <Button
          onClick={() => setActiveTab("history")}
          type="button"
          variant={activeTab === "history" ? "default" : "outline"}
        >
          History
        </Button>
      </div>

      {activeTab === "send" ? (
        <Card>
          <CardHeader>
            <CardTitle>Transfer money</CardTitle>
            <CardDescription>
              Move money between your accounts or send it to someone else.
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      resetToForm();
                      setMode("own");
                    }}
                    type="button"
                    variant={mode === "own" ? "default" : "outline"}
                  >
                    Between my accounts
                  </Button>
                  <Button
                    onClick={() => {
                      resetToForm();
                      setMode("beneficiary");
                    }}
                    type="button"
                    variant={mode === "beneficiary" ? "default" : "outline"}
                  >
                    To someone else
                  </Button>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="from_account">From</Label>
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

                  {mode === "own" ? (
                    <div className="space-y-2">
                      <Label htmlFor="to_account">To</Label>
                      <Select
                        id="to_account"
                        onChange={(event) => setToAccountId(event.target.value)}
                        value={toAccountId}
                      >
                        <option value="">Select an account</option>
                        {availableDestinationAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {getAccountOptionLabel(account)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="beneficiary">Pay to</Label>
                      <Select
                        id="beneficiary"
                        onChange={(event) => {
                          const value = event.target.value;
                          setBeneficiaryId(value === NEW_PAYEE_VALUE ? "" : value);
                          setShowNewPayeeForm(value === NEW_PAYEE_VALUE);
                        }}
                        value={showNewPayeeForm ? NEW_PAYEE_VALUE : beneficiaryId}
                      >
                        <option value="">Select a payee</option>
                        {beneficiaries.map((beneficiary) => (
                          <option key={beneficiary.id} value={beneficiary.id}>
                            {beneficiary.name} {maskAccountNumber(beneficiary.account_number)}
                          </option>
                        ))}
                        <option value={NEW_PAYEE_VALUE}>+ Add new payee</option>
                      </Select>
                    </div>
                  )}
                </div>

                {mode === "beneficiary" && showNewPayeeForm ? (
                  <div className="grid gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="payee_name">Payee name</Label>
                      <Input
                        id="payee_name"
                        onBlur={(event) =>
                          setPayeeErrors((current) => ({
                            ...current,
                            name:
                              validatePayeeField("name", event.target.value) || undefined
                          }))
                        }
                        onChange={(event) =>
                          setNewPayee((current) => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                        value={newPayee.name}
                      />
                      {payeeErrors.name ? (
                        <p className="text-sm text-red-600">{payeeErrors.name}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payee_account_number">Account no.</Label>
                      <Input
                        id="payee_account_number"
                        onBlur={(event) =>
                          setPayeeErrors((current) => ({
                            ...current,
                            account_number:
                              validatePayeeField(
                                "account_number",
                                event.target.value
                              ) || undefined
                          }))
                        }
                        onChange={(event) =>
                          setNewPayee((current) => ({
                            ...current,
                            account_number: event.target.value
                          }))
                        }
                        value={newPayee.account_number}
                      />
                      {payeeErrors.account_number ? (
                        <p className="text-sm text-red-600">
                          {payeeErrors.account_number}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payee_sort_code">Sort code</Label>
                      <Input
                        id="payee_sort_code"
                        onBlur={(event) =>
                          setPayeeErrors((current) => ({
                            ...current,
                            sort_code:
                              validatePayeeField("sort_code", event.target.value) ||
                              undefined
                          }))
                        }
                        onChange={(event) =>
                          setNewPayee((current) => ({
                            ...current,
                            sort_code: event.target.value
                          }))
                        }
                        placeholder="12-34-56"
                        value={newPayee.sort_code}
                      />
                      {payeeErrors.sort_code ? (
                        <p className="text-sm text-red-600">{payeeErrors.sort_code}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payee_bank_name">Bank name</Label>
                      <Input
                        id="payee_bank_name"
                        onChange={(event) =>
                          setNewPayee((current) => ({
                            ...current,
                            bank_name: event.target.value
                          }))
                        }
                        value={newPayee.bank_name}
                      />
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

                <div className="grid gap-5 md:grid-cols-2">
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
                    <Label htmlFor="reference">Reference</Label>
                    <Input
                      id="reference"
                      maxLength={18}
                      onChange={(event) => setReference(event.target.value)}
                      value={reference}
                    />
                  </div>
                </div>

                <Button onClick={() => void handleReview()} type="button">
                  Review Transfer
                </Button>
              </>
            ) : null}

            {screen === "review" && transferSummary ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-950">
                    Review your transfer
                  </h3>
                  <p className="text-sm text-slate-500">
                    Check the details before you confirm.
                  </p>
                </div>

                <dl className="grid gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-slate-500">From</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {transferSummary.fromLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">To</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {transferSummary.toLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Amount</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {formatGBP(transferSummary.amountPence)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Reference</dt>
                    <dd className="mt-1 font-medium text-slate-950">
                      {transferSummary.reference}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => setScreen("form")}
                    type="button"
                    variant="outline"
                  >
                    {"<- Go back"}
                  </Button>
                  <Button
                    disabled={isSubmitting}
                    onClick={() => void handleConfirmTransfer()}
                    type="button"
                  >
                    {isSubmitting ? "Confirming transfer" : "Confirm Transfer"}
                  </Button>
                </div>
              </div>
            ) : null}

            {screen === "success" && successSummary ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-slate-950">
                    Transfer complete
                  </h3>
                  <p className="text-sm text-slate-500">
                    Reference: {successReference}
                  </p>
                  <p className="text-base text-slate-700">
                    {formatGBP(successSummary.amountPence)} sent to{" "}
                    {successSummary.toLabel}
                  </p>
                </div>
                <Button asChild>
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            ) : null}

            {screen === "error" ? (
              <div className="space-y-4">
                <Alert className="border-red-200 bg-red-50 text-red-900">
                  {errorMessage || "Transfer failed. Please try again."}
                </Alert>
                <Button onClick={resetToForm} type="button" variant="outline">
                  Try again
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Transfer history</CardTitle>
            <CardDescription>
              Transactions with a reference attached, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {history.length > 0 ? (
              history.map((transaction) => (
                <div
                  className="grid gap-3 rounded-2xl border border-slate-100 px-4 py-4 md:grid-cols-[140px_1fr_140px_120px] md:items-center"
                  key={transaction.id}
                >
                  <p className="text-sm text-slate-500">
                    {formatDate(transaction.created_at)}
                  </p>
                  <p className="font-medium text-slate-950">
                    {transaction.description ?? transaction.merchant ?? "Transfer"}
                  </p>
                  <p
                    className={`text-sm font-semibold ${getTransactionTone(transaction.direction)}`}
                  >
                    {getTransactionPrefix(transaction.direction)}
                    {formatGBP(transaction.amount_pence)}
                  </p>
                  <Badge className="bg-slate-100 text-slate-600">
                    {transaction.direction}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No transfer history is available yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
