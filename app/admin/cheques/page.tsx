import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { ChequeReviewTable } from "@/components/modules/admin/ChequeReviewTable";
import { formatAdminStatusLabel } from "@/lib/admin";
import { getAdminServerContext } from "@/lib/admin-server";
import { getSignedUrl, logServerError } from "@/lib/route-helpers";
import { formatGBP } from "@/utils/currency";

export const dynamic = "force-dynamic";

export default async function AdminChequesPage() {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin } = context;
  const { data: chequeRowsData } = await admin
    .from("check_images")
    .select(
      "id, user_id, account_id, amount_pence, storage_path, created_at, status, rejection_reason"
    )
    .order("created_at", { ascending: false });

  const chequeRows =
    (chequeRowsData ?? []) as Array<{
      account_id: string;
      amount_pence: number | null;
      created_at: string;
      id: string;
      rejection_reason: string | null;
      storage_path: string;
      status: "pending" | "processing" | "processed" | "rejected";
      user_id: string;
    }>;

  const accountIds = [...new Set(chequeRows.map((row) => row.account_id))];
  const userIds = [...new Set(chequeRows.map((row) => row.user_id))];

  const [{ data: accountRows }, { data: customerRows }] = await Promise.all([
    accountIds.length > 0
      ? admin.from("accounts").select("id, account_number").in("id", accountIds)
      : { data: [] as Array<{ id: string; account_number: string }> },
    userIds.length > 0
      ? admin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as Array<{ id: string; full_name: string }> }
  ]);

  const accountNumberMap = Object.fromEntries(
    (accountRows ?? []).map((account) => [
      account.id as string,
      account.account_number as string
    ])
  );
  const customerNameMap = Object.fromEntries(
    (customerRows ?? []).map((profile) => [
      profile.id as string,
      profile.full_name as string
    ])
  );

  const rows = await Promise.all(
    chequeRows.map(async (row) => {
      let previewUrl: string | null = null;

      if (row.storage_path) {
        try {
          previewUrl = await getSignedUrl("cheques", row.storage_path);
        } catch (error) {
          logServerError("admin.cheques.preview", error);
        }
      }

      return {
        account_number: accountNumberMap[row.account_id] ?? "",
        amount_pence: row.amount_pence,
        created_at: row.created_at,
        customer_name: customerNameMap[row.user_id] ?? "Unknown customer",
        id: row.id,
        preview_url: previewUrl,
        rejection_reason: row.rejection_reason,
        status: row.status
      };
    })
  );

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const processedCount = rows.filter((row) => row.status === "processed").length;
  const rejectedCount = rows.filter((row) => row.status === "rejected").length;
  const pendingAmountPence = rows
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + (row.amount_pence ?? 0), 0);
  const summaryCards = [
    {
      description: "Deposits waiting for staff action",
      label: "Pending review",
      value: pendingCount
    },
    {
      description: "Approved and credited deposits",
      label: "Processed",
      value: processedCount
    },
    {
      description: "Deposits rejected with reason captured",
      label: "Rejected",
      value: rejectedCount
    },
    {
      description: "Funds queued across pending cheques",
      label: "Pending value",
      value: formatGBP(pendingAmountPence)
    }
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Cheque review
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Approving credits the account and posts a transaction. Rejecting
          records the reason and notifies the customer.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {card.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>
            Filter by {formatAdminStatusLabel("pending")} or inspect historic
            outcomes in the same console.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChequeReviewTable items={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
