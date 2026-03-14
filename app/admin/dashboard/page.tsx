import Link from "next/link";
import {
  ArrowRight,
  CheckSquare,
  ShieldAlert,
  Users,
  Wallet
} from "lucide-react";

import { AdminOverviewCharts } from "@/components/modules/admin/AdminOverviewCharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getAuthEmailMap, getAdminServerContext } from "@/lib/admin-server";
import { formatGBP } from "@/utils/currency";
import { formatDate, formatRelative } from "@/utils/dates";

export const dynamic = "force-dynamic";

type MonthlyOperationsPoint = {
  cheques: number;
  customers: number;
  fraud: number;
  key: string;
  month: string;
  tickets: number;
};

function buildMonthlySeries(monthCount = 6): MonthlyOperationsPoint[] {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit"
  });
  const today = new Date();

  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() - (monthCount - index - 1),
      1
    );

    return {
      cheques: 0,
      customers: 0,
      fraud: 0,
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: formatter.format(date),
      tickets: 0
    };
  });
}

function addMonthlyCounts(
  series: MonthlyOperationsPoint[],
  values: string[],
  key: "cheques" | "customers" | "fraud" | "tickets"
) {
  const map = Object.fromEntries(series.map((point) => [point.key, point]));

  values.forEach((value) => {
    const date = new Date(value);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

    if (map[monthKey]) {
      map[monthKey][key] += 1;
    }
  });
}

export default async function AdminDashboardPage() {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin } = context;
  const [
    { count: totalCustomersCount },
    { count: activeAccountsCount },
    { count: openFraudAlertsCount },
    { count: pendingChequesCount },
    { data: recentCustomersData },
    { data: activeFraudAlertsData },
    { data: customerTimelineData },
    { data: supportTicketTimelineData },
    { data: chequeTimelineData },
    { data: fraudTimelineData }
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer"),
    admin
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    admin
      .from("fraud_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "flagged"),
    admin
      .from("check_images")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("fraud_events")
      .select("id, user_id, transaction_id, trigger_reason, created_at")
      .eq("status", "flagged")
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("created_at")
      .eq("role", "customer")
      .gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString())
      .order("created_at", { ascending: true }),
    admin
      .from("support_tickets")
      .select("created_at")
      .gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString())
      .order("created_at", { ascending: true }),
    admin
      .from("check_images")
      .select("created_at")
      .gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString())
      .order("created_at", { ascending: true }),
    admin
      .from("fraud_events")
      .select("created_at")
      .gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString())
      .order("created_at", { ascending: true })
  ]);

  const recentCustomers = (recentCustomersData ?? []) as Array<{
    created_at: string;
    full_name: string;
    id: string;
  }>;
  const activeFraudAlerts = (activeFraudAlertsData ?? []) as Array<{
    created_at: string;
    id: string;
    transaction_id: string | null;
    trigger_reason: string | null;
    user_id: string;
  }>;
  const emailMap = await getAuthEmailMap(
    recentCustomers.map((customer) => customer.id)
  );

  const customerIds = [...new Set(activeFraudAlerts.map((alert) => alert.user_id))];
  const transactionIds = [
    ...new Set(
      activeFraudAlerts
        .map((alert) => alert.transaction_id)
        .filter((value): value is string => Boolean(value))
    )
  ];
  const [{ data: customerProfiles }, { data: fraudTransactions }] = await Promise.all([
    customerIds.length > 0
      ? admin.from("profiles").select("id, full_name").in("id", customerIds)
      : { data: [] as Array<{ id: string; full_name: string }> },
    transactionIds.length > 0
      ? admin
          .from("transactions")
          .select("id, amount_pence, description, merchant")
          .in("id", transactionIds)
      : {
          data: [] as Array<{
            amount_pence: number;
            description: string | null;
            id: string;
            merchant: string | null;
          }>
        }
  ]);

  const customerNameMap = Object.fromEntries(
    (customerProfiles ?? []).map((profile) => [
      profile.id as string,
      profile.full_name as string
    ])
  );
  const fraudTransactionMap = Object.fromEntries(
    (fraudTransactions ?? []).map((transaction) => [
      transaction.id as string,
      {
        amount_pence: transaction.amount_pence as number,
        description:
          (transaction.description as string | null) ??
          (transaction.merchant as string | null) ??
          "Transaction"
      }
    ])
  );

  const monthlySeries = buildMonthlySeries();
  addMonthlyCounts(
    monthlySeries,
    ((customerTimelineData ?? []) as Array<{ created_at: string }>).map(
      (row) => row.created_at
    ),
    "customers"
  );
  addMonthlyCounts(
    monthlySeries,
    ((supportTicketTimelineData ?? []) as Array<{ created_at: string }>).map(
      (row) => row.created_at
    ),
    "tickets"
  );
  addMonthlyCounts(
    monthlySeries,
    ((chequeTimelineData ?? []) as Array<{ created_at: string }>).map(
      (row) => row.created_at
    ),
    "cheques"
  );
  addMonthlyCounts(
    monthlySeries,
    ((fraudTimelineData ?? []) as Array<{ created_at: string }>).map(
      (row) => row.created_at
    ),
    "fraud"
  );

  const stats = [
    {
      description: "Browse customer profiles and support history.",
      href: "/admin/customers",
      icon: Users,
      label: "Total customers",
      tone: "bg-[#eef2ff] text-[#2440a8]",
      value: totalCustomersCount ?? 0
    },
    {
      description: "Active customer balances across all live accounts.",
      href: "/admin/customers",
      icon: Wallet,
      label: "Active accounts",
      tone: "bg-[#eefbf4] text-[#0f8a4c]",
      value: activeAccountsCount ?? 0
    },
    {
      description: "Flagged fraud cases waiting for review.",
      href: "/admin/fraud",
      icon: ShieldAlert,
      label: "Open fraud alerts",
      tone: "bg-[#fff1f1] text-[#d63b3b]",
      value: openFraudAlertsCount ?? 0
    },
    {
      description: "Cheque deposits still waiting for approval.",
      href: "/admin/cheques",
      icon: CheckSquare,
      label: "Pending cheques",
      tone: "bg-[#fff6ea] text-[#b96900]",
      value: pendingChequesCount ?? 0
    }
  ] as const;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/45 bg-[linear-gradient(135deg,#101f45_0%,#2440a8_52%,#4b66e8_100%)] px-6 py-7 text-white shadow-[0_34px_110px_rgba(25,41,96,0.24)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-8 top-4 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-8 top-6 h-24 w-24 rounded-full bg-[#ffd1e1]/18 blur-3xl" />
        </div>

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="inline-flex rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/84 backdrop-blur">
              Admin overview
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Operations pulse
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/74">
              Monitor onboarding, active account footprint, fraud exposure, and
              cheque review volume from one dashboard.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {stats.slice(0, 2).map((stat) => (
              <div
                className="rounded-[1.5rem] border border-white/14 bg-white/10 p-4 backdrop-blur"
                key={stat.label}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/56">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
                <p className="mt-2 text-sm text-white/70">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ description, href, icon: Icon, label, tone, value }) => (
          <Link className="group block" href={href} key={label}>
            <Card className="h-full border-white/60 bg-white/80 transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(37,58,130,0.14)]">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                      {value}
                    </p>
                  </div>
                  <div className={`rounded-2xl p-2.5 ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">{description}</p>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <AdminOverviewCharts monthlySeries={monthlySeries} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="banking-panel border-white/55 bg-white/75">
          <CardHeader>
            <CardTitle>Recent customers</CardTitle>
            <CardDescription>
              The latest customer profiles added to the bank.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCustomers.length > 0 ? (
              recentCustomers.map((customer) => (
                <Link
                  className="group grid gap-3 rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4 transition hover:bg-white md:grid-cols-[1.1fr_1.4fr_120px_32px] md:items-center"
                  href={`/admin/customers/${customer.id}`}
                  key={customer.id}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Name
                    </p>
                    <p className="mt-1 font-medium text-slate-950">
                      {customer.full_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Email
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {emailMap[customer.id] ?? "No email"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Joined
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(customer.created_at)}
                    </p>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-slate-400 transition group-hover:translate-x-1 md:block" />
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                No customers found.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="banking-panel border-white/55 bg-white/75">
          <CardHeader>
            <CardTitle>Active fraud alerts</CardTitle>
            <CardDescription>
              Flagged alerts waiting for a fraud decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeFraudAlerts.length > 0 ? (
              activeFraudAlerts.map((alert) => {
                const linkedTransaction = alert.transaction_id
                  ? fraudTransactionMap[alert.transaction_id]
                  : null;

                return (
                  <Link
                    className="group block rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4 transition hover:bg-white"
                    href={`/admin/fraud/${alert.id}`}
                    key={alert.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {customerNameMap[alert.user_id] ?? "Unknown customer"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {alert.trigger_reason ?? "No reason provided"}
                        </p>
                      </div>
                      <div className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                        Flagged
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-500 md:grid-cols-[1fr_120px_32px] md:items-center">
                      <div>
                        {linkedTransaction ? (
                          <p>
                            {linkedTransaction.description} for{" "}
                            {formatGBP(linkedTransaction.amount_pence)}
                          </p>
                        ) : (
                          <p>No transaction data linked</p>
                        )}
                      </div>
                      <p>{formatRelative(alert.created_at)}</p>
                      <ArrowRight className="hidden h-4 w-4 text-slate-400 transition group-hover:translate-x-1 md:block" />
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500">
                No active alerts
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
