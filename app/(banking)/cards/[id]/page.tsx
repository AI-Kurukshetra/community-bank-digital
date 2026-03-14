import { notFound } from "next/navigation";

import { CardDetailClient } from "@/components/modules/cards/CardDetailClient";
import { requireCustomerServerSession } from "@/lib/customer-server";
import type { Card as BankCard, Transaction } from "@/types";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({
  params
}: {
  params: { id: string };
}) {
  const { supabase, user } = await requireCustomerServerSession();
  const { data: cardData } = await supabase
    .from("cards")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cardData) {
    notFound();
  }

  const card = cardData as BankCard;
  const { data: transactionsData } = await supabase
    .from("transactions")
    .select("*")
    .eq("account_id", card.account_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <CardDetailClient
      card={card}
      transactions={(transactionsData ?? []) as Transaction[]}
    />
  );
}
