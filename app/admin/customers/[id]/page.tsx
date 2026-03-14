import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CreditCard,
  LifeBuoy,
  ShieldAlert,
  Wallet2
} from "lucide-react";

import { AdminCustomerDeleteButton } from "@/components/modules/admin/AdminCustomerDeleteButton";
import { AdminCustomerFormDialog } from "@/components/modules/admin/AdminCustomerFormDialog";
import { AdminTransactionFlagButton } from "@/components/modules/admin/AdminTransactionFlagButton";
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
import {
  formatAdminStatusLabel,
  getAccountActivityBadgeClass,
  getCardStatusBadgeClass,
  getFraudStatusBadgeClass,
  getProfileStatusBadgeClass,
  getTicketPriorityBadgeClass,
  getTicketStatusBadgeClass
} from "@/lib/admin";
import { getAuthEmailByUserId, getAdminServerContext } from "@/lib/admin-server";
import { formatCardExpiry, getAccountTypeLabel } from "@/lib/banking";
import type {
  Account,
  Card as BankCard,
  FraudEvent,
  Profile,
  SupportTicket,
  Transaction
} from "@/types";
import { writeAuditLog } from "@/utils/audit";
import { formatGBP } from "@/utils/currency";
import { formatDate, formatDateTime, formatRelative } from "@/utils/dates";
import { maskAccountNumber, maskSortCode } from "@/utils/maskAccount";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params
}: {
  params: { id: string };
}) {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin, user } = context;
  const { data: customerData } = await admin
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .eq("role", "customer")
    .maybeSingle();

  const customer = (customerData ?? null) as Profile | null;

  if (!customer) {
    notFound();
  }

  await writeAuditLog(admin, {
    action: "admin_customer_viewed",
    actor_id: user.id,
    entity_id: customer.id,
    entity_type: "profile",
    metadata: {
      screen: "customer_detail"
    }
  });

  const customerEmail = await getAuthEmailByUserId(customer.id);
  const [
    { data: accountsData },
    { data: cardsData },
    { data: fraudEventsData },
    { data: supportTicketsData }
  ] = await Promise.all([
    admin
      .from("accounts")
      .select("*")
      .eq("user_id", customer.id)
      .order("created_at", { ascending: true }),
    admin
      .from("cards")
      .select("*")
      .eq("user_id", customer.id)
      .order("created_at", { ascending: false }),
    admin
      .from("fraud_events")
      .select("*")
      .eq("user_id", customer.id)
      .order("created_at", { ascending: false }),
    admin
      .from("support_tickets")
      .select("*")
      .eq("user_id", customer.id)
      .order("updated_at", { ascending: false })
  ]);

  const accounts = (accountsData ?? []) as unknown as Account[];
  const cards = (cardsData ?? []) as unknown as BankCard[];
  const fraudEvents = (fraudEventsData ?? []) as unknown as FraudEvent[];
  const supportTickets = (supportTicketsData ?? []) as unknown as SupportTicket[];

  const accountIds = accounts.map((account) => account.id);
  const fraudTransactionIds = [
    ...new Set(
      fraudEvents
        .map((event) => event.transaction_id)
        .filter((value): value is string => Boolean(value))
    )
  ];
  const relatedProfileIds = [
    ...new Set(
      [...fraudEvents.map((event) => event.reviewed_by), ...supportTickets.map((ticket) => ticket.assigned_to)].filter(
        (value): value is string => Boolean(value)
      )
    )
  ];

  const [{ data: transactionsData }, { data: fraudTransactionsData }, { data: relatedProfilesData }] =
    await Promise.all([
      accountIds.length > 0
        ? admin
            .from("transactions")
            .select("*")
            .in("account_id", accountIds)
            .order("created_at", { ascending: false })
            .limit(24)
        : Promise.resolve({ data: [] as Transaction[] }),
      fraudTransactionIds.length > 0
        ? admin
            .from("transactions")
            .select("*")
            .in("id", fraudTransactionIds)
        : Promise.resolve({ data: [] as Transaction[] }),
      relatedProfileIds.length > 0
        ? admin
            .from("profiles")
            .select("id, full_name")
            .in("id", relatedProfileIds)
        : Promise.resolve({ data: [] as Array<Pick<Profile, "id" | "full_name">> })
    ]);

  const transactions = (transactionsData ?? []) as Transaction[];
  const linkedFraudTransactions = (fraudTransactionsData ?? []) as Transaction[];
  const relatedProfiles =
    (relatedProfilesData ?? []) as Array<Pick<Profile, "id" | "full_name">>;

  const accountMap = Object.fromEntries(accounts.map((account) => [account.id, account]));
  const transactionMap = Object.fromEntries(
    linkedFraudTransactions.map((transaction) => [transaction.id, transaction])
  );
  const relatedProfileMap = Object.fromEntries(
    relatedProfiles.map((profile) => [profile.id, profile.full_name])
  );
  const flaggedTransactionIds = new Set(
    fraudEvents
      .map((event) => event.transaction_id)
      .filter((value): value is string => Boolean(value))
  );
  const totalBalancePence = accounts.reduce(
    (sum, account) => sum + account.balance_pence,
    0
  );
  const activeAccountCount = accounts.filter((account) => account.is_active).length;
  const activeCardCount = cards.filter((card) => card.status === "active").length;
  const frozenCardCount = cards.filter((card) => card.status === "frozen").length;
  const openSupportCount = supportTickets.filter(
    (ticket) => ticket.status !== "resolved"
  ).length;
  const flaggedFraudCount = fraudEvents.filter(
    (event) => event.status === "flagged"
  ).length;
  const confirmedFraudCount = fraudEvents.filter(
    (event) => event.status === "confirmed"
  ).length;
  const lastActivityAt = [
    customer.created_at,
    ...transactions.map((transaction) => transaction.created_at),
    ...supportTickets.map((ticket) => ticket.updated_at),
    ...fraudEvents.map((event) => event.created_at)
  ].sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

  const summaryCards = [
    {
      description: `${activeAccountCount} active of ${accounts.length} total`,
      icon: Wallet2,
      label: "Balances",
      tone: "bg-[#eef2ff] text-[#233cff]",
      value: formatGBP(totalBalancePence)
    },
    {
      description: `${frozenCardCount} frozen for risk controls`,
      icon: CreditCard,
      label: "Cards",
      tone: "bg-[#fff5e9] text-[#b45c00]",
      value: `${activeCardCount} active`
    },
    {
      description: `${confirmedFraudCount} confirmed incidents on record`,
      icon: ShieldAlert,
      label: "Fraud",
      tone: "bg-[#fff1f1] text-[#d63b3b]",
      value: `${flaggedFraudCount} open`
    },
    {
      description: `${supportTickets.length} total requests submitted`,
      icon: LifeBuoy,
      label: "Support",
      tone: "bg-[#effbf4] text-[#0f8a4c]",
      value: `${openSupportCount} open`
    }
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton fallbackHref="/admin/customers" label="Back to customers" />

        <div className="flex flex-wrap gap-2">
          <AdminCustomerFormDialog
            customer={{
              email: customerEmail,
              full_name: customer.full_name,
              id: customer.id,
              phone: customer.phone,
              status: customer.status
            }}
            mode="edit"
            triggerLabel="Edit customer"
          />
          <AdminCustomerDeleteButton
            customerId={customer.id}
            customerName={customer.full_name}
            redirectTo="/admin/customers"
          />
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/45 bg-[linear-gradient(135deg,#101f45_0%,#2440a8_46%,#4b66e8_100%)] px-6 py-7 text-white shadow-[0_34px_110px_rgba(25,41,96,0.28)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-8 top-6 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-6 top-4 h-24 w-24 rounded-full bg-[#ffd0df]/18 blur-3xl" />
        </div>

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/14 text-white">
                Customer detail
              </Badge>
              <Badge className={getProfileStatusBadgeClass(customer.status)}>
                {formatAdminStatusLabel(customer.status)}
              </Badge>
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              {customer.full_name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Full customer relationship view across accounts, cards,
              transactions, fraud cases, and support history.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                  Email
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {customerEmail ?? "No email"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                  Phone
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {customer.phone ?? "No phone"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                  Joined
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {formatDate(customer.created_at)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                  Last activity
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {lastActivityAt ? formatRelative(lastActivityAt) : "No activity"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            {summaryCards.map(({ description, icon: Icon, label, tone, value }) => (
              <div
                className="rounded-[1.5rem] border border-white/14 bg-white/10 p-4 backdrop-blur"
                key={label}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                      {label}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
                  </div>
                  <div className={`rounded-2xl p-2.5 ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/70">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="banking-panel border-white/55 bg-white/75">
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>
                Live balances, availability, and linked account identifiers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <div
                    className="rounded-[1.5rem] border border-white/70 bg-white/75 px-4 py-4"
                    key={account.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-[#0A2540]/10 text-[#0A2540]">
                            {getAccountTypeLabel(account.type)}
                          </Badge>
                          <Badge className={getAccountActivityBadgeClass(account.is_active)}>
                            {account.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                          {formatGBP(account.balance_pence)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Opened
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatDate(account.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Account number
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-950">
                          {maskAccountNumber(account.account_number)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Sort code
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-950">
                          {maskSortCode(account.sort_code)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Account id
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-600">
                          {account.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  No accounts found for this customer.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="banking-panel border-white/55 bg-white/75">
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                The latest account activity with manual fraud flagging available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {transactions.length > 0 ? (
                transactions.map((transaction) => {
                  const account = accountMap[transaction.account_id];

                  return (
                    <div
                      className="grid gap-4 rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_140px_150px_auto]"
                      key={transaction.id}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-slate-100 text-slate-600">
                            {transaction.category.replace(/_/g, " ")}
                          </Badge>
                          {transaction.reference ? (
                            <Badge className="bg-[#eef2ff] text-[#3047ff]">
                              {transaction.reference}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-3 font-semibold text-slate-950">
                          {transaction.description ??
                            transaction.merchant ??
                            "Transaction"}
                        </p>
                        <div className="mt-2 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                          <p>
                            {formatDateTime(transaction.created_at)}
                          </p>
                          <p>
                            {account
                              ? `${getAccountTypeLabel(account.type)} ${maskAccountNumber(account.account_number)}`
                              : "Unknown account"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Direction
                        </p>
                        <p
                          className={`mt-2 text-sm font-semibold ${
                            transaction.direction === "credit"
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {transaction.direction === "credit" ? "+" : "-"}
                          {formatGBP(transaction.amount_pence)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Transaction id
                        </p>
                        <p className="mt-2 font-mono text-xs text-slate-600">
                          {transaction.id.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="md:justify-self-end">
                        <AdminTransactionFlagButton
                          customerId={customer.id}
                          initialFlagged={flaggedTransactionIds.has(transaction.id)}
                          transactionId={transaction.id}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  No transactions are available yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="banking-panel border-white/55 bg-white/75">
            <CardHeader>
              <CardTitle>Cards</CardTitle>
              <CardDescription>
                Card status, linked account, limits, and expiry information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cards.length > 0 ? (
                cards.map((card) => {
                  const account = accountMap[card.account_id];

                  return (
                    <div
                      className="rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4"
                      key={card.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-[#eef2ff] text-[#3047ff]">
                              {formatAdminStatusLabel(card.card_type)}
                            </Badge>
                            <Badge className={getCardStatusBadgeClass(card.status)}>
                              {formatAdminStatusLabel(card.status)}
                            </Badge>
                          </div>
                          <p className="mt-3 font-semibold text-slate-950">
                            {card.masked_number}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatCardExpiry(card.expires_at)}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            Daily limit
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-950">
                            {formatGBP(card.daily_limit_pence)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            Linked account
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-950">
                            {account
                              ? maskAccountNumber(account.account_number)
                              : "Unknown account"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  No cards found for this customer.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="banking-panel border-white/55 bg-white/75">
            <CardHeader>
              <CardTitle>Fraud alerts</CardTitle>
              <CardDescription>
                Open and resolved fraud investigations for this customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fraudEvents.length > 0 ? (
                fraudEvents.map((event) => {
                  const linkedTransaction = event.transaction_id
                    ? transactionMap[event.transaction_id]
                    : null;

                  return (
                    <div
                      className="rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4"
                      key={event.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={getFraudStatusBadgeClass(event.status)}>
                              {formatAdminStatusLabel(event.status)}
                            </Badge>
                            {event.reviewed_by ? (
                              <Badge className="bg-slate-100 text-slate-600">
                                Reviewed by{" "}
                                {relatedProfileMap[event.reviewed_by] ?? "Team"}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-3 font-semibold text-slate-950">
                            {event.trigger_reason ?? "No reason provided"}
                          </p>
                        </div>
                        <Button asChild size="sm" type="button" variant="outline">
                          <Link href={`/admin/fraud/${event.id}`}>Review</Link>
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-slate-600">
                        <p>Flagged {formatRelative(event.created_at)}</p>
                        {linkedTransaction ? (
                          <div className="rounded-2xl bg-slate-50 px-3 py-3">
                            <p className="font-medium text-slate-950">
                              Linked transaction
                            </p>
                            <p className="mt-1">
                              {(linkedTransaction.description ??
                                linkedTransaction.merchant ??
                                "Transaction")}{" "}
                              for {formatGBP(linkedTransaction.amount_pence)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  No fraud alerts recorded.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="banking-panel border-white/55 bg-white/75">
            <CardHeader>
              <CardTitle>Support tickets</CardTitle>
              <CardDescription>
                Customer help requests with status, priority, and ownership.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {supportTickets.length > 0 ? (
                supportTickets.map((ticket) => (
                  <div
                    className="rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4"
                    key={ticket.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={getTicketPriorityBadgeClass(ticket.priority)}>
                            {formatAdminStatusLabel(ticket.priority)}
                          </Badge>
                          <Badge className={getTicketStatusBadgeClass(ticket.status)}>
                            {formatAdminStatusLabel(ticket.status)}
                          </Badge>
                        </div>
                        <p className="mt-3 font-semibold text-slate-950">
                          {ticket.subject}
                        </p>
                      </div>
                      <Button asChild size="sm" type="button" variant="outline">
                        <Link href={`/admin/support/${ticket.id}`}>View</Link>
                      </Button>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                      {ticket.body}
                    </p>

                    <div className="mt-4 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                      <p>Updated {formatRelative(ticket.updated_at)}</p>
                      <p>
                        {ticket.assigned_to
                          ? `Assigned to ${relatedProfileMap[ticket.assigned_to] ?? "Team"}`
                          : "Waiting for assignment"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  No support tickets have been created yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {(flaggedFraudCount > 0 || openSupportCount > 0) && (
        <Card className="border-red-100 bg-[linear-gradient(135deg,rgba(255,244,244,0.96),rgba(255,250,247,0.98))]">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-red-100 p-2.5 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-950">
                  Action required on this profile
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {flaggedFraudCount > 0
                    ? `${flaggedFraudCount} fraud alert${flaggedFraudCount === 1 ? "" : "s"}`
                    : `${openSupportCount} support ticket${openSupportCount === 1 ? "" : "s"}`}{" "}
                  still need an operational decision.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {flaggedFraudCount > 0 ? (
                <Button asChild type="button" variant="outline">
                  <Link href="/admin/fraud">Open fraud queue</Link>
                </Button>
              ) : null}
              {openSupportCount > 0 ? (
                <Button asChild type="button" variant="outline">
                  <Link href="/admin/support">Open support queue</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
