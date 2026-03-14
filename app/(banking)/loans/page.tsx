import Link from "next/link";
import { ArrowUpRight, Landmark } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { requireCustomerServerSession } from "@/lib/customer-server";
import type { Loan } from "@/types";
import { formatGBP } from "@/utils/currency";
import { formatDate } from "@/utils/dates";

export const dynamic = "force-dynamic";

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

export default async function LoansPage() {
  const { supabase, user } = await requireCustomerServerSession();
  const { data: loansData } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const loans = (loansData ?? []) as Loan[];

  return (
    <div className="space-y-6">
      <section className="banking-panel p-6">
        <div>
          <p className="banking-chip">Borrowing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Loans
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            View and manage your active loans and repayment schedules.
          </p>
        </div>
      </section>

      {loans.length === 0 ? (
        <Card className="banking-panel border-white/50 bg-white/70">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
              <Landmark className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-950">
                No active loans
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Contact us to apply for a loan.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-[#3047ff] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#2538cc]"
              href="/support"
            >
              Contact support
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {loans.map((loan) => {
            const progressPercent = Math.min(
              100,
              Math.round(
                ((loan.principal_pence - loan.balance_pence) /
                  loan.principal_pence) *
                  100
              )
            );

            return (
              <Link href={`/loans/${loan.id}`} key={loan.id}>
                <Card className="banking-panel border-white/50 bg-white/70 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(92,81,176,0.12)]">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#eef0ff] px-3 py-1 text-xs font-semibold text-[#3047ff]">
                          {getLoanTypeLabel(loan.loan_type)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(loan.status)}`}
                        >
                          {loan.status === "paid_off"
                            ? "Paid Off"
                            : loan.status.charAt(0).toUpperCase() +
                              loan.status.slice(1)}
                        </span>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-400" />
                    </div>

                    <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                      {formatGBP(loan.balance_pence)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Outstanding balance
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
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
                          Rate
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {(loan.rate_bps / 100).toFixed(2)}% p.a.
                        </p>
                      </div>
                    </div>

                    {loan.next_payment_date ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Next payment:{" "}
                        <span className="font-medium text-slate-700">
                          {formatDate(loan.next_payment_date)}
                        </span>
                      </p>
                    ) : null}

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{progressPercent}% paid</span>
                        <span>{formatGBP(loan.principal_pence)} total</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#3047ff,#6f78ff)]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
