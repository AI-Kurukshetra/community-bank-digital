"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquareText,
  ShieldAlert
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Account, SupportTicket } from "@/types";
import { formatDate, formatRelative } from "@/utils/dates";
import { formatGBP } from "@/utils/currency";

const categories = [
  "Payments",
  "Cards",
  "Fraud",
  "Statements",
  "Profile",
  "Other"
] as const;

type SupportCategory = (typeof categories)[number];

const categoryCopy: Record<
  SupportCategory,
  { helper: string; tone: string }
> = {
  Cards: {
    helper: "Card delivery, card controls, lost or stolen card issues.",
    tone: "bg-[#eef2ff] text-[#3047ff]"
  },
  Fraud: {
    helper: "Unauthorised payments, scams, or suspicious activity concerns.",
    tone: "bg-[#fff1f1] text-[#d63b3b]"
  },
  Other: {
    helper: "General questions that do not fit another banking workflow.",
    tone: "bg-slate-100 text-slate-700"
  },
  Payments: {
    helper: "Transfers, bill payments, cheque deposit, and money movement.",
    tone: "bg-[#eefbf4] text-[#118454]"
  },
  Profile: {
    helper: "Personal details, login issues, and device or access changes.",
    tone: "bg-[#fff6ea] text-[#b96900]"
  },
  Statements: {
    helper: "Statement copies, account letters, and document questions.",
    tone: "bg-[#f5f0ff] text-[#7b4ce2]"
  }
};

function getStatusBadge(status: string) {
  switch (status) {
    case "open":
      return "bg-amber-100 text-amber-700";
    case "in_progress":
      return "bg-blue-100 text-blue-700";
    case "resolved":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700";
    case "low":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

async function fetchSupportPageData(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string
) {
  const [{ data: ticketsData }, { data: accountsData }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
  ]);

  return {
    accounts: (accountsData ?? []) as Account[],
    tickets: (ticketsData ?? []) as SupportTicket[]
  };
}

export default function SupportPage() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<SupportCategory>("Payments");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const userId = user.id;
    let isCancelled = false;

    async function run() {
      setLoading(true);
      const data = await fetchSupportPageData(supabase, userId);

      if (isCancelled) {
        return;
      }

      setTickets(data.tickets);
      setAccounts(data.accounts);
      setSelectedAccountId((current) => current || data.accounts[0]?.id || "");
      setLoading(false);
    }

    void run();

    return () => {
      isCancelled = true;
    };
  }, [supabase, user?.id]);

  async function handleSubmit() {
    if (!user?.id || !subject.trim() || body.trim().length < 20 || submitting) {
      return;
    }

    const userId = user.id;
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/v1/support", {
        body: JSON.stringify({
          body: body.trim(),
          category,
          related_account_id: selectedAccountId || null,
          subject: subject.trim()
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        priority?: string;
        reference?: string;
      };

      if (!response.ok) {
        setMessage(payload.error || "Failed to submit request.");
        setMessageType("error");
        return;
      }

      setMessage(
        `Ticket #${payload.reference ?? "pending"} created and added to the support queue.`
      );
      setMessageType("success");
      setSubject("");
      setBody("");
      setCategory("Payments");
      const data = await fetchSupportPageData(supabase, userId);

      setTickets(data.tickets);
      setAccounts(data.accounts);
      setSelectedAccountId((current) => current || data.accounts[0]?.id || "");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleTicket(ticketId: string) {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
      return;
    }

    setExpandedTicketId(ticketId);
  }

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const inProgressCount = tickets.filter(
    (ticket) => ticket.status === "in_progress"
  ).length;
  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === "resolved"
  ).length;
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3047ff] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/45 bg-[linear-gradient(135deg,#10214d_0%,#1f4cc8_52%,#6a73ff_100%)] px-6 py-7 text-white shadow-[0_30px_95px_rgba(29,56,140,0.25)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-6 top-4 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-8 top-6 h-24 w-24 rounded-full bg-[#ffd5e5]/18 blur-3xl" />
        </div>

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div>
            <p className="inline-flex rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/84 backdrop-blur">
              Support centre
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Help &amp; Support
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/74">
              Generate a support ticket with category and account context, then
              track it from creation through resolution in the same queue your
              bank staff review.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/56">
                  Open
                </p>
                <p className="mt-3 text-3xl font-semibold">{openCount}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/56">
                  In progress
                </p>
                <p className="mt-3 text-3xl font-semibold">{inProgressCount}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/56">
                  Resolved
                </p>
                <p className="mt-3 text-3xl font-semibold">{resolvedCount}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              {
                icon: MessageSquareText,
                text: "1. Choose the category and the account affected."
              },
              {
                icon: ShieldAlert,
                text: "2. Describe the issue with enough detail for triage."
              },
              {
                icon: CheckCircle2,
                text: "3. Submit and watch the ticket move through the queue."
              }
            ].map(({ icon: Icon, text }) => (
              <div
                className="flex items-start gap-3 rounded-[1.5rem] border border-white/14 bg-white/10 px-4 py-4 backdrop-blur"
                key={text}
              >
                <div className="rounded-2xl bg-white/12 p-2.5 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm leading-6 text-white/76">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Card className="banking-panel border-white/50 bg-white/70">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Create ticket</h3>
              <p className="mt-1 text-sm text-slate-500">
                New tickets route directly into the support queue for bank staff.
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${categoryCopy[category].tone}`}
            >
              {category}: {categoryCopy[category].helper}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px]">
            <div>
              <label className="text-sm font-medium text-slate-700">Subject</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                onChange={(event) => setSubject(event.target.value)}
                value={subject}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                onChange={(event) => setCategory(event.target.value as SupportCategory)}
                value={category}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Related account
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                onChange={(event) => setSelectedAccountId(event.target.value)}
                value={selectedAccountId}
              >
                <option value="">None selected</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.type.charAt(0).toUpperCase() + account.type.slice(1)}{" "}
                    {formatGBP(account.balance_pence)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">
              Details <span className="text-slate-400">(min 20 characters)</span>
            </label>
            <textarea
              className="mt-1 min-h-[150px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              onChange={(event) => setBody(event.target.value)}
              value={body}
            />
          </div>
          <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <p className="font-medium text-slate-950">Ticket preview</p>
            <p className="mt-2">
              Category: <span className="font-medium">{category}</span>
            </p>
            <p className="mt-1">
              Related account:{" "}
              <span className="font-medium">
                {selectedAccount
                  ? `${selectedAccount.type} ${formatGBP(selectedAccount.balance_pence)}`
                  : "No account selected"}
              </span>
            </p>
          </div>
          {message ? (
            <p className={`text-sm ${messageType === "success" ? "text-emerald-600" : "text-red-600"}`}>
              {message}
            </p>
          ) : null}
          <Button
            className="rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
            disabled={!subject.trim() || body.trim().length < 20 || submitting}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {submitting ? (
              "Submitting..."
            ) : (
              <>
                Submit ticket
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <section className="banking-panel p-6">
        <div>
          <p className="banking-chip">Queue</p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
            My requests
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Expand any item to review the original request submitted to support.
          </p>
        </div>

        {tickets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">You have no support tickets.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id}>
                <button
                  className="grid w-full gap-3 rounded-[1.5rem] border border-white/65 bg-white/65 px-5 py-4 text-left transition hover:bg-white/80 md:grid-cols-[110px_1fr_120px_120px_120px] md:items-center"
                  onClick={() => void toggleTicket(ticket.id)}
                  type="button"
                >
                  <p className="font-mono text-sm text-slate-500">#{ticket.id.slice(-8)}</p>
                  <div>
                    <p className="font-semibold text-slate-950">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Updated {formatRelative(ticket.updated_at)}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${getPriorityBadge(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(ticket.status)}`}>
                    {formatStatusLabel(ticket.status)}
                  </span>
                  <p className="text-sm text-slate-500">{formatDate(ticket.created_at)}</p>
                </button>

                {expandedTicketId === ticket.id ? (
                  <div className="mt-2 rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm whitespace-pre-line text-slate-700">{ticket.body}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Submitted {formatDate(ticket.created_at)}
                    </p>
                    <p className="mt-4 text-sm text-slate-500">
                      Ticket replies have been removed from this build. Track the
                      status above and our team will review the request through
                      the support queue.
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
