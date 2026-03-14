import Link from "next/link";

import { CardDisplay } from "@/components/modules/cards/CardDisplay";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { requireCustomerServerSession } from "@/lib/customer-server";
import type { Card as BankCard } from "@/types";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const { supabase, user } = await requireCustomerServerSession();
  const { data } = await supabase
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const cards = (data ?? []) as BankCard[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Cards
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage cards linked to your customer accounts.
        </p>
      </div>

      {cards.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <Link href={`/cards/${card.id}`} key={card.id}>
              <CardDisplay card={card} size="sm" />
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No cards found</CardTitle>
            <CardDescription>
              Cards will appear here when they are issued to this customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              There are currently no cards linked to your accounts.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
