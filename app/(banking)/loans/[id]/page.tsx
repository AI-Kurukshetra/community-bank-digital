"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Account, Loan, Transaction } from "@/types";
import { formatGBP, poundsToPence, penceToPounds } from "@/utils/currency";
import { formatDate } from "@/utils/dates";

function getLoanTypeLabel(type: string) {
  switch (type) {
    case "personal":
      return "Personal Loan";
    case "mortgage":
      return "Mortgage";
    case "auto":
      return "Auto Loan";
    case "business":
      return "Business Loan";
    default:
      return "Loan";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "paid_off":
      return "bg-blue-100 text-blue-700";
    case "defaulted":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function LoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  useEffect(() => {
    async function loadData() {
      if (!user?.id) {
        return;
      }

      const loanId = params.id as string;
      const { data: loanData } = await supabase
        .from("loans")
        .select("*")
        .eq("id", loanId)
        .maybeSingle();

      if (!loanData || (loanData as Loan).user_id !== user.id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const loanRecord = loanData as Loan;
      setLoan(loanRecord);
      setPaymentAmount(
        penceToPounds(loanRecord.monthly_payment_pence).toFixed(2)
      );

      const { data: accountsData } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const nextAccounts = (accountsData ?? []) as Account[];
      setAccounts(nextAccounts);
      if (nextAccounts.length > 0) {
        setFromAccountId(nextAccounts[0].id);
      }

      if (loanRecord.account_id) {
        const { data: transactionData } = await supabase
          .from("transactions")
          .select("*")
          .eq("account_id", loanRecord.account_id)
          .ilike("description", "%loan%")
          .order("created_at", { ascending: false })
          .limit(20);

        setTransactions((transactionData ?? []) as Transaction[]);
      }

      setLoading(false);
    }

    void loadData();
  }, [params.id, supabase, user?.id]);

  async function handlePayment() {
    if (!loan || !fromAccountId || paying) {
      return;
    }

    const amountPence = poundsToPence(Number(paymentAmount));
    if (isNaN(amountPence) || amountPence <= 0) {
      setMessage("Enter a valid amount.");
      setMessageType("error");
      return;
    }

    setPaying(true);
    setMessage("");

    try {
      const response = await fetch("/api/v1/loan-payment", {
        body: JSON.stringify({
          amount_pence: amountPence,
          from_account_id: fromAccountId,
          loan_id: loan.id
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setMessage(data.error || "Payment failed.");
        setMessageType("error");
      } else {
        setMessage("Payment applied to your loan.");
        setMessageType("success");
        router.refresh();

        const { data: updatedLoan } = await supabase
          .from("loans")
          .select("*")
          .eq("id", loan.id)
          .maybeSingle();

        if (updatedLoan) {
          setLoan(updatedLoan as Loan);
        }
      }
    } catch {
      setMessage("Payment failed. Please try again.");
      setMessageType("error");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3047ff] border-t-transparent" />
      </div>
    );
  }

  if (notFound || !loan) {
    return (
      <div className="banking-panel p-8 text-center">
        <p className="text-lg font-semibold text-slate-950">Loan not found</p>
        <p className="mt-2 text-sm text-slate-500">
          This loan does not exist or you do not have access.
        </p>
        <BackButton className="mt-4" fallbackHref="/loans" label="Back to loans" />
      </div>
    );
  }

  const progressPercent = Math.min(
    100,
    Math.round(
      ((loan.principal_pence - loan.balance_pence) / loan.principal_pence) * 100
    )
  );

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/loans" label="Back to loans" />

      <section className="banking-panel p-6">
        <div className="flex flex-wrap items-start gap-3">
          <span className="rounded-full bg-[#eef0ff] px-3 py-1 text-xs font-semibold text-[#3047ff]">
            {getLoanTypeLabel(loan.loan_type)}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(loan.status)}`}
          >
            {loan.status === "paid_off"
              ? "Paid Off"
              : loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
          </span>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="text-sm text-slate-500">Outstanding balance</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-950">
              {formatGBP(loan.balance_pence)}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Rate
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {(loan.rate_bps / 100).toFixed(2)}% p.a.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Monthly
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {formatGBP(loan.monthly_payment_pence)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Next payment
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {loan.next_payment_date
                    ? formatDate(loan.next_payment_date)
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  End date
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {loan.end_date ? formatDate(loan.end_date) : "-"}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{progressPercent}% paid</span>
                <span>{formatGBP(loan.principal_pence)} total</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#3047ff,#6f78ff)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {loan.status === "active" ? (
            <Card className="border-white/50 bg-white/70">
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-slate-950">
                  Make a payment
                </h3>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Amount (GBP)
                    </label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#3047ff] focus:outline-none focus:ring-2 focus:ring-[#3047ff]/20"
                      min="0.01"
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      step="0.01"
                      type="number"
                      value={paymentAmount}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      From account
                    </label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#3047ff] focus:outline-none focus:ring-2 focus:ring-[#3047ff]/20"
                      onChange={(event) => setFromAccountId(event.target.value)}
                      value={fromAccountId}
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.type.charAt(0).toUpperCase() +
                            account.type.slice(1)}{" "}
                          - {formatGBP(account.balance_pence)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    className="w-full rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
                    disabled={paying}
                    onClick={() => void handlePayment()}
                    type="button"
                  >
                    {paying ? (
                      "Processing..."
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirm Payment
                      </>
                    )}
                  </Button>

                  {message ? (
                    <p
                      className={`text-sm ${
                        messageType === "success"
                          ? "text-emerald-600"
                          : "text-red-500"
                      }`}
                    >
                      {message}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : loan.status === "paid_off" ? (
            <Card className="border-white/50 bg-emerald-50">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-lg font-semibold text-emerald-700">
                  Loan fully paid
                </p>
                <p className="text-sm text-emerald-600">
                  Congratulations! This loan has been fully repaid.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      {transactions.length > 0 ? (
        <section className="banking-panel p-6">
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">
            Payment history
          </h3>
          <div className="mt-4 space-y-3">
            {transactions.map((transaction) => (
              <div
                className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-4 py-3"
                key={transaction.id}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {formatDate(transaction.created_at)}
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {transaction.description ?? "Loan payment"}
                  </p>
                </div>
                <p className="font-semibold text-red-600">
                  -{formatGBP(transaction.amount_pence)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
