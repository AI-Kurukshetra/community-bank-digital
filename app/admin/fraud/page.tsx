import { FraudTableClient } from "@/components/modules/admin/FraudTableClient";
import { getAdminServerContext } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export default async function AdminFraudPage() {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin } = context;
  const { data: fraudEventsData } = await admin
    .from("fraud_events")
    .select("id, user_id, trigger_reason, status, created_at")
    .order("created_at", { ascending: false });

  const fraudEvents = fraudEventsData ?? [];
  const customerIds = [...new Set(fraudEvents.map((event) => event.user_id as string))];
  const { data: customerProfiles } =
    customerIds.length > 0
      ? await admin.from("profiles").select("id, full_name").in("id", customerIds)
      : { data: [] as { id: string; full_name: string }[] };

  const customerNameMap = Object.fromEntries(
    (customerProfiles ?? []).map((profile) => [
      profile.id as string,
      profile.full_name as string
    ])
  );

  return (
    <FraudTableClient
      fraudEvents={fraudEvents.map((event) => ({
        created_at: event.created_at as string,
        customer_name:
          customerNameMap[event.user_id as string] ?? "Unknown customer",
        id: event.id as string,
        status: event.status as "flagged" | "confirmed" | "dismissed",
        trigger_reason: event.trigger_reason as string | null
      }))}
    />
  );
}
