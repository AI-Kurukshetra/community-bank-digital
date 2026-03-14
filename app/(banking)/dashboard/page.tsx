import Link from "next/link";
import {
  ArrowRightLeft,
  ArrowUpRight,
  CreditCard,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet
} from "lucide-react";

import { AccountCard } from "@/components/modules/accounts/AccountCard";
import { Card, CardContent } from "@/components/ui/card";
import { getTransactionPrefix, getTransactionTone } from "@/lib/banking";
import { requireCustomerServerSession } from "@/lib/customer-server";
import type { Account, Transaction } from "@/types";
import { formatGBP } from "@/utils/currency";
import { formatDate } from "@/utils/dates";
import { maskAccountNumber } from "@/utils/maskAccount";

export const dynamic = "force-dynamic";

const quickActions = [
  {
    description: "Move money between your accounts or saved payees.",
    href: "/transfers",
    icon: ArrowRightLeft,
    label: "Transfer Money"
  },
  {
    description: "Pay regular bills without leaving your dashboard.",
    href: "/payments/bill-pay",
    icon: ReceiptText,
    label: "Pay a Bill"
  },
  {
    description: "Freeze, unfreeze, or cancel cards from one place.",
    href: "/cards",
    icon: CreditCard,
    label: "Manage Cards"
  }
] as const;

export default async function DashboardPage() {
  const { supabase, user } = await requireCustomerServerSession();
  const { data: accountsData } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const accounts = (accountsData ?? []) as Account[];
  const accountIds = accounts.map((account) => account.id);

  let recentTransactions: Transaction[] = [];

  if (accountIds.length > 0) {
    const { data: transactionsData } = await supabase
      .from("transactions")
      .select("*")
      .in("account_id", accountIds)
      .order("created_at", { ascending: false })
      .limit(10);

    recentTransactions = (transactionsData ?? []) as Transaction[];
  }

  const totalBalancePence = accounts.reduce(
    (sum, account) => sum + account.balance_pence,
    0
  );
  const totalCreditsPence = recentTransactions.reduce(
    (sum, transaction) =>
      transaction.direction === "credit"
        ? sum + transaction.amount_pence
        : sum,
    0
  );
  const totalDebitsPence = recentTransactions.reduce(
    (sum, transaction) =>
      transaction.direction === "debit" ? sum + transaction.amount_pence : sum,
    0
  );
  const primaryAccount = accounts[0] ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/45 px-6 py-7 text-white shadow-[0_34px_110px_rgba(79,69,169,0.2)]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#2646ff_0%,#6a73ff_55%,#f17ab1_100%)]" />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-6 top-2 h-24 w-24 rounded-full bg-white/24 blur-3xl" />
            <div className="absolute right-8 top-8 h-24 w-24 rounded-full bg-[#ffd3e9]/24 blur-3xl" />
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <span className="inline-flex rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/86 backdrop-blur">
                Portfolio overview
              </span>
              <p className="mt-5 text-sm font-medium text-white/72">
                Total available balance
              </p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight sm:text-[3.2rem]">
                {formatGBP(totalBalancePence)}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/76">
                Across {accounts.length} linked{" "}
                {accounts.length === 1 ? "account" : "accounts"} with current
                balances ready to move.
              </p>
              {primaryAccount ? (
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-3 py-2 text-sm text-white/86 backdrop-blur">
                  <Wallet className="h-4 w-4" />
                  Primary account {maskAccountNumber(primaryAccount.account_number)}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[1.5rem] border border-white/18 bg-white/12 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/64">
                  Active accounts
                </p>
                <p className="mt-3 text-3xl font-semibold">{accounts.length}</p>
                <p className="mt-2 text-sm text-white/72">
                  Personal balances grouped in one view.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/18 bg-white/12 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/64">
                  Recent credits
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {formatGBP(totalCreditsPence)}
                </p>
                <p className="mt-2 text-sm text-white/72">
                  Incoming activity from the latest transactions.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/18 bg-white/12 p-4 backdrop-blur sm:col-span-2 lg:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/64">
                  Recent debits
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {formatGBP(totalDebitsPence)}
                </p>
                <p className="mt-2 text-sm text-white/72">
                  Outgoing activity you can review below.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="banking-chip">Linked accounts</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Account overview
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Premium surfaces for the balances you use most.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard account={account} key={account.id} />
            ))}

            {accounts.length === 0 ? (
              <Card className="banking-panel border-white/50 bg-white/70">
                <CardContent className="p-6">
                  <p className="text-sm text-slate-500">
                    No accounts are available for this profile yet.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>

        <section className="banking-panel p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="banking-chip">Activity</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Recent transactions
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                The latest movement across all of your accounts.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-4 py-4"
                  key={transaction.id}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        transaction.direction === "credit"
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-rose-100 text-rose-500"
                      }`}
                    >
                      {transaction.direction === "credit" ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        {formatDate(transaction.created_at)}
                      </p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {transaction.description ??
                          transaction.merchant ??
                          "Transaction"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-base font-semibold ${getTransactionTone(transaction.direction)}`}
                    >
                      {getTransactionPrefix(transaction.direction)}
                      {formatGBP(transaction.amount_pence)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {transaction.direction}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No recent transactions are available yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="banking-panel p-6">
          <div>
            <p className="banking-chip">Actions</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Quick actions
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Common customer journeys, styled like control modules.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {quickActions.map(({ href, icon: Icon, label, description }) => (
              <Link
                className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,238,255,0.88))] px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(92,81,176,0.12)]"
                href={href}
                key={href}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">{label}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {description}
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>

        <section className="banking-panel p-6">
          <div>
            <p className="banking-chip">Snapshot</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Cash flow
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              A compact read of recent money movement.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.5rem] bg-[#eef2ff] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Money in
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {formatGBP(totalCreditsPence)}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-[#fff0f4] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Money out
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {formatGBP(totalDebitsPence)}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/72 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Latest activity
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {recentTransactions[0]
                  ? formatDate(recentTransactions[0].created_at)
                  : "No activity yet"}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/14 bg-[#171d48] p-6 text-white shadow-[0_30px_90px_rgba(16,22,66,0.28)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/58">
            Security
          </p>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight">
            Protected banking
          </h3>
          <p className="mt-3 text-sm leading-6 text-white/68">
            Sensitive actions stay behind fraud monitoring, masked account
            details, and card controls that are always close by.
          </p>
        </section>
      </div>
    </div>
  );
}
