"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Account, Statement } from "@/types";
import { formatDate } from "@/utils/dates";
import { maskAccountNumber } from "@/utils/maskAccount";

import { StatementsDownloadButton } from "./StatementsDownloadButton";

export default function StatementsPage() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
      if (!user?.id) {
        return;
      }

      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      const nextAccounts = (data ?? []) as Account[];
      setAccounts(nextAccounts);
      setSelectedAccountId((current) => current || nextAccounts[0]?.id || "");
    }

    void loadAccounts();
  }, [supabase, user?.id]);

  useEffect(() => {
    async function loadStatements() {
      if (!selectedAccountId) {
        setStatements([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data } = await supabase
        .from("statements")
        .select("*")
        .eq("account_id", selectedAccountId)
        .order("period_end", { ascending: false });

      setStatements((data ?? []) as Statement[]);
      setLoading(false);
    }

    void loadStatements();
  }, [selectedAccountId, supabase]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);

  return (
    <div className="space-y-6">
      <section className="banking-panel p-6">
        <div>
          <p className="banking-chip">Documents</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Statements
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Download account statements by account and period.
          </p>
        </div>

        <div className="mt-6">
          <label className="text-sm font-medium text-slate-700">Account</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm md:max-w-md"
            onChange={(event) => setSelectedAccountId(event.target.value)}
            value={selectedAccountId}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.type.charAt(0).toUpperCase() + account.type.slice(1)} - {maskAccountNumber(account.account_number)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3047ff] border-t-transparent" />
        </div>
      ) : statements.length === 0 ? (
        <Card className="banking-panel border-white/50 bg-white/70">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
              <FileText className="h-7 w-7" />
            </div>
            <p className="text-lg font-semibold text-slate-950">No statements available</p>
            <p className="text-sm text-slate-500">Statements for this account will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {statements.map((statement) => (
            <div
              className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-5 py-4"
              key={statement.id}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-950">
                    {formatDate(statement.period_start)} - {formatDate(statement.period_end)}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {selectedAccount
                      ? maskAccountNumber(selectedAccount.account_number)
                      : "Account"}
                  </p>
                </div>
              </div>

              <StatementsDownloadButton statementId={statement.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
