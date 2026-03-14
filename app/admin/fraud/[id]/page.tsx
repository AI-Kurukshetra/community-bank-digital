import Link from "next/link";
import { notFound } from "next/navigation";

import { FraudReviewActions } from "@/components/modules/admin/FraudReviewActions";
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
  getFraudStatusBadgeClass
} from "@/lib/admin";
import { getAuthEmailByUserId, getAdminServerContext } from "@/lib/admin-server";
import type { FraudEvent, Profile, Transaction } from "@/types";
import { formatGBP } from "@/utils/currency";
import { formatDate, formatRelative } from "@/utils/dates";

export const dynamic = "force-dynamic";

export default async function AdminFraudDetailPage({
  params
}: {
  params: { id: string };
}) {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin } = context;
  const { data: fraudEventData } = await admin
    .from("fraud_events")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const fraudEvent = (fraudEventData ?? null) as FraudEvent | null;

  if (!fraudEvent) {
    notFound();
  }

  const [
    { data: customerProfileData },
    transactionResult,
    { data: cardRows },
    { count: openSupportCount }
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", fraudEvent.user_id)
      .maybeSingle(),
    fraudEvent.transaction_id
      ? admin
          .from("transactions")
          .select("*")
          .eq("id", fraudEvent.transaction_id)
          .maybeSingle()
      : Promise.resolve({ data: null as Transaction | null }),
    admin
      .from("cards")
      .select("id, status")
      .eq("user_id", fraudEvent.user_id),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fraudEvent.user_id)
      .neq("status", "resolved")
  ]);

  const customerProfile = (customerProfileData ?? null) as Pick<
    Profile,
    "id" | "full_name"
  > | null;
  const transaction = (transactionResult.data ?? null) as Transaction | null;
  const customerEmail = await getAuthEmailByUserId(fraudEvent.user_id);
  const activeCardCount = (cardRows ?? []).filter(
    (card) => card.status === "active"
  ).length;
  const frozenCardCount = (cardRows ?? []).filter(
    (card) => card.status === "frozen"
  ).length;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/admin/fraud" label="Back to fraud" />

      <Card>
        <CardHeader>
          <CardTitle>Fraud alert</CardTitle>
          <CardDescription>
            Review suspicious activity and decide the customer outcome.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Customer
              </p>
              <p className="mt-1 font-medium text-slate-950">
                {customerProfile?.full_name ?? "Unknown customer"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Email
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {customerEmail ?? "No email"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Status
              </p>
              <div className="mt-1">
                <Badge className={getFraudStatusBadgeClass(fraudEvent.status)}>
                  {formatAdminStatusLabel(fraudEvent.status)}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Trigger reason
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {fraudEvent.trigger_reason ?? "No reason provided"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Time flagged
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatRelative(fraudEvent.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Active cards
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {activeCardCount} active, {frozenCardCount} frozen
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Open support tickets
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {openSupportCount ?? 0}
              </p>
            </div>
          </div>

          {transaction ? (
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Linked transaction
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Amount
                  </p>
                  <p className="mt-1 font-medium text-slate-950">
                    {formatGBP(transaction.amount_pence)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Description
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {transaction.description ??
                      transaction.merchant ??
                      "Transaction"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Date
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(transaction.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Category
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {transaction.category.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link href={`/admin/customers/${fraudEvent.user_id}`}>
                Open customer profile
              </Link>
            </Button>
            {openSupportCount ? (
              <Button asChild type="button" variant="outline">
                <Link href="/admin/support">Open support queue</Link>
              </Button>
            ) : null}
          </div>

          <FraudReviewActions
            fraudEventId={fraudEvent.id}
            initialStatus={fraudEvent.status}
            variant="stack"
          />
        </CardContent>
      </Card>
    </div>
  );
}
