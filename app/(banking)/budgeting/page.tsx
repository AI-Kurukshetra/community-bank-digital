"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingDown } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Account, Transaction } from "@/types";
import { formatGBP } from "@/utils/currency";
import { formatDate } from "@/utils/dates";

const CATEGORY_COLORS: Record<string, string> = {
  food_drink: "#3047ff",
  transport: "#6f78ff",
  shopping: "#f47bac",
  bills: "#ff9f43",
  entertainment: "#a855f7",
  health: "#10b981",
  salary: "#06b6d4",
  transfer: "#64748b",
  other: "#94a3b8"
};

const CATEGORY_LABELS: Record<string, string> = {
  food_drink: "Food & Drink",
  transport: "Transport",
  shopping: "Shopping",
  bills: "Bills",
  entertainment: "Entertainment",
  health: "Health",
  salary: "Salary",
  transfer: "Transfer",
  other: "Other"
};

export default function BudgetingPage() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(currentMonth);

  useEffect(() => {
    async function loadAccounts() {
      if (!user?.id) return;
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id);

      const accs = (data ?? []) as Account[];
      setAccounts(accs);
      setSelectedAccountId((current) => current || accs[0]?.id || "");
    }

    void loadAccounts();
  }, [supabase, user?.id]);

  useEffect(() => {
    async function loadTransactions() {
      if (!selectedAccountId) return;
      setLoading(true);

      const startOfMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1
      );
      const endOfMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      );
      const startOfPrevMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1
      );

      const [{ data: currentData }, { data: prevData }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("direction", "debit")
          .gte("created_at", startOfMonth.toISOString())
          .lt("created_at", endOfMonth.toISOString())
          .neq("category", "transfer")
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("amount_pence")
          .eq("account_id", selectedAccountId)
          .eq("direction", "debit")
          .gte("created_at", startOfPrevMonth.toISOString())
          .lt("created_at", startOfMonth.toISOString())
          .neq("category", "transfer")
      ]);

      setTransactions((currentData ?? []) as Transaction[]);
      setPrevMonthTotal(
        ((prevData ?? []) as { amount_pence: number }[]).reduce(
          (sum, r) => sum + r.amount_pence,
          0
        )
      );
      setLoading(false);
    }

    void loadTransactions();
  }, [supabase, selectedAccountId, currentMonth]);

  const totalSpent = transactions.reduce(
    (sum, t) => sum + t.amount_pence,
    0
  );

  const changePercent =
    prevMonthTotal > 0
      ? Math.round(((totalSpent - prevMonthTotal) / prevMonthTotal) * 100)
      : 0;

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      const cat = t.category || "other";
      map[cat] = (map[cat] || 0) + t.amount_pence;
    }

    return Object.entries(map)
      .map(([category, total]) => ({
        category,
        label: CATEGORY_LABELS[category] || category,
        total,
        percent: totalSpent > 0 ? Math.round((total / totalSpent) * 100) : 0,
        color: CATEGORY_COLORS[category] || "#94a3b8"
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, totalSpent]);

  const last10 = transactions.slice(0, 10);

  return (
    <div className="space-y-6">
      <section className="banking-panel p-6">
        <div>
          <p className="banking-chip">Spending</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Budgeting
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Analyse your spending by category each month.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition hover:bg-slate-50"
              onClick={() => setMonthOffset((o) => o - 1)}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-slate-950">
              {monthLabel}
            </span>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition hover:bg-slate-50"
              disabled={monthOffset >= 0}
              onClick={() => setMonthOffset((o) => o + 1)}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#3047ff] focus:outline-none"
            onChange={(e) => setSelectedAccountId(e.target.value)}
            value={selectedAccountId}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.type.charAt(0).toUpperCase() + a.type.slice(1)} - {formatGBP(a.balance_pence)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3047ff] border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="banking-panel border-white/50 bg-white/70">
              <CardContent className="p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Total spent
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatGBP(totalSpent)}
                </p>
                {prevMonthTotal > 0 ? (
                  <p
                    className={`mt-2 text-sm font-medium ${
                      changePercent > 0 ? "text-red-500" : "text-emerald-600"
                    }`}
                  >
                    {changePercent > 0 ? "Up" : "Down"} {Math.abs(changePercent)}% vs
                    {" "}last month
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">
                  Transfers excluded from spending analysis.
                </p>
              </CardContent>
            </Card>

            <Card className="banking-panel border-white/50 bg-white/70">
              <CardContent className="flex items-center justify-center p-6">
                {categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer height={200} width="100%">
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="50%"
                        data={categoryBreakdown}
                        dataKey="total"
                        innerRadius={50}
                        nameKey="label"
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {categoryBreakdown.map((entry) => (
                          <Cell
                            fill={entry.color}
                            key={entry.category}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatGBP(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-500">
                    No spending data for this period.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {categoryBreakdown.length > 0 ? (
            <section className="banking-panel p-6">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                Category breakdown
              </h3>
              <div className="mt-4 space-y-3">
                {categoryBreakdown.map((cat) => (
                  <div
                    className="flex items-center gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-4 py-3"
                    key={cat.category}
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-950">
                          {cat.label}
                        </p>
                        <div className="text-right">
                          <p className="font-semibold text-slate-950">
                            {formatGBP(cat.total)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {cat.percent}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: cat.color,
                            width: `${cat.percent}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {last10.length > 0 ? (
            <section className="banking-panel p-6">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                Recent spending
              </h3>
              <div className="mt-4 space-y-3">
                {last10.map((txn) => (
                  <div
                    className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-4 py-3"
                    key={txn.id}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
                        <TrendingDown className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          {formatDate(txn.created_at)}
                        </p>
                        <p className="mt-0.5 font-semibold text-slate-950">
                          {txn.description ?? txn.merchant ?? "Transaction"}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-red-600">
                      -{formatGBP(txn.amount_pence)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
