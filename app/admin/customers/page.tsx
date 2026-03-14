import { AdminCustomersTable } from "@/components/modules/admin/AdminCustomersTable";
import { getAdminServerContext, getAuthEmailMap } from "@/lib/admin-server";
import { writeAuditLog } from "@/utils/audit";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin, user } = context;
  const { data: customersData } = await admin
    .from("profiles")
    .select("id, full_name, phone, status, created_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  const customers = customersData ?? [];
  const customerIds = customers.map((customer) => customer.id as string);
  const [{ data: accountRows }, emailMap] = await Promise.all([
    customerIds.length > 0
      ? admin.from("accounts").select("user_id").in("user_id", customerIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    getAuthEmailMap(customerIds)
  ]);

  const accountCounts = (accountRows ?? []).reduce<Record<string, number>>(
    (counts, account) => {
      const accountUserId = account.user_id as string;

      counts[accountUserId] = (counts[accountUserId] ?? 0) + 1;

      return counts;
    },
    {}
  );

  await writeAuditLog(admin, {
    action: "admin_customers_viewed",
    actor_id: user.id,
    entity_type: "profiles"
  });

  return (
    <AdminCustomersTable
      customers={customers.map((customer) => ({
        accountsCount: accountCounts[customer.id as string] ?? 0,
        created_at: customer.created_at as string,
        email: emailMap[customer.id as string] ?? null,
        full_name: customer.full_name as string,
        id: customer.id as string,
        phone: (customer.phone as string | null) ?? null,
        status: customer.status as string
      }))}
    />
  );
}
