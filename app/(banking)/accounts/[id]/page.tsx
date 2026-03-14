import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountFilters } from "@/components/modules/accounts/AccountFilters";
import { StopPaymentRequestButton } from "@/components/modules/accounts/StopPaymentRequestButton";
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
import { CATEGORIES } from "@/constants/categories";
import {
  getAccountTypeLabel,
  getTransactionPrefix,
  getTransactionTone
} from "@/lib/banking";
import { requireCustomerServerSession } from "@/lib/customer-server";
import type { Account, Transaction } from "@/types";
import { formatGBP } from "@/utils/currency";
import { formatDate } from "@/utils/dates";
import { maskAccountNumber, maskSortCode } from "@/utils/maskAccount";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function getParam(
  value: string | string[] | undefined,
  fallback = ""
): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function sanitizeSearchTerm(value: string) {
  return value.replace(/[,%()]/g, " ").trim();
}

export default async function AccountDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireCustomerServerSession();
  const { data: accountData } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!accountData) {
    notFound();
  }

  const account = accountData as Account;
  const page = Math.max(Number(getParam(searchParams.page, "1")) || 1, 1);
  const direction = getParam(searchParams.direction, "all");
  const category = getParam(searchParams.category, "all");
  const dateFrom = getParam(searchParams.from);
  const dateTo = getParam(searchParams.to);
  const query = sanitizeSearchTerm(getParam(searchParams.query));

  let transactionsQuery = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("account_id", account.id);

  if (direction === "credit" || direction === "debit") {
    transactionsQuery = transactionsQuery.eq("direction", direction);
  }

  if (CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    transactionsQuery = transactionsQuery.eq("category", category);
  }

  if (dateFrom) {
    transactionsQuery = transactionsQuery.gte(
      "created_at",
      `${dateFrom}T00:00:00.000Z`
    );
  }

  if (dateTo) {
    transactionsQuery = transactionsQuery.lte(
      "created_at",
      `${dateTo}T23:59:59.999Z`
    );
  }

  if (query) {
    transactionsQuery = transactionsQuery.or(
      `description.ilike.%${query}%,merchant.ilike.%${query}%`
    );
  }

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;
  const { data: transactionsData, count } = await transactionsQuery
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  const transactions = (transactionsData ?? []) as Transaction[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  function buildPageHref(nextPageNumber: number) {
    const nextParams = new URLSearchParams();

    Object.entries(searchParams).forEach(([key, value]) => {
      const normalized = getParam(value);

      if (normalized) {
        nextParams.set(key, normalized);
      }
    });

    nextParams.set("page", `${nextPageNumber}`);

    return `/accounts/${account.id}?${nextParams.toString()}`;
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/accounts" label="Back to accounts" />

      <Card>
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-[#0A2540]/10 text-[#0A2540]">
              {getAccountTypeLabel(account.type)}
            </Badge>
            <span className="text-sm font-medium text-slate-600">
              {maskAccountNumber(account.account_number)}
            </span>
            <span className="text-sm text-slate-500">
              {maskSortCode(account.sort_code)}
            </span>
          </div>
          <div>
            <p className="text-sm text-slate-500">Available balance</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              {formatGBP(account.balance_pence)}
            </p>
          </div>
        </CardContent>
      </Card>

      <AccountFilters />

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            Filter recent activity by direction, category, date, or text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <div
                className="flex flex-col gap-4 rounded-2xl border border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between"
                key={transaction.id}
              >
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">
                    {formatDate(transaction.created_at)}
                  </p>
                  <p className="font-medium text-slate-950">
                    {transaction.description ??
                      transaction.merchant ??
                      "Transaction"}
                  </p>
                  <Badge className="bg-slate-100 text-slate-600">
                    {transaction.category.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p
                  className={`text-sm font-semibold ${getTransactionTone(transaction.direction)}`}
                >
                  {getTransactionPrefix(transaction.direction)}
                  {formatGBP(transaction.amount_pence)}
                </p>
                {transaction.direction === "debit" ? (
                  <StopPaymentRequestButton
                    amountPence={transaction.amount_pence}
                    createdAt={transaction.created_at}
                    transactionId={transaction.id}
                  />
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No transactions match the selected filters.
            </p>
          )}

          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 md:flex-row">
            {page <= 1 ? (
              <Button disabled type="button" variant="outline">
                Previous
              </Button>
            ) : (
              <Button asChild type="button" variant="outline">
                <Link href={buildPageHref(previousPage)}>Previous</Link>
              </Button>
            )}
            <p>
              Page {Math.min(page, totalPages)} of {totalPages}
            </p>
            {page >= totalPages ? (
              <Button disabled type="button" variant="outline">
                Next
              </Button>
            ) : (
              <Button asChild type="button" variant="outline">
                <Link href={buildPageHref(nextPage)}>Next</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
