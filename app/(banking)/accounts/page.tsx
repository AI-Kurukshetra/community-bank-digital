import { AccountCard } from "@/components/modules/accounts/AccountCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { requireCustomerServerSession } from "@/lib/customer-server";
import type { Account } from "@/types";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const { supabase, user } = await requireCustomerServerSession();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const accounts = (data ?? []) as Account[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Accounts
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          View every customer account linked to your profile.
        </p>
      </div>

      {accounts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard account={account} key={account.id} />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No accounts found</CardTitle>
            <CardDescription>
              Accounts will appear here once they are opened.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              There are no active accounts for this customer profile yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
