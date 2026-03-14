import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { AdminSupportTable } from "@/components/modules/admin/AdminSupportTable";
import { getAdminServerContext } from "@/lib/admin-server";
import type { SupportTicket } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin, user } = context;
  const { data: ticketsData } = await admin
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  const tickets = (ticketsData ?? []) as unknown as SupportTicket[];
  const customerIds = [...new Set(tickets.map((ticket) => ticket.user_id))];
  const { data: customerProfiles } =
    customerIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name")
          .in("id", customerIds)
      : { data: [] as Array<{ id: string; full_name: string }> };

  const customerNameMap = Object.fromEntries(
    (customerProfiles ?? []).map((profile) => [
      profile.id as string,
      profile.full_name as string
    ])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Support Tickets</CardTitle>
        <CardDescription>
          Triage customer requests, assign ownership, and resolve cases.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AdminSupportTable
          currentUserId={user.id}
          tickets={tickets.map((ticket) => ({
            assigned_to: ticket.assigned_to,
            created_at: ticket.created_at,
            customer_name: customerNameMap[ticket.user_id] ?? "Unknown customer",
            id: ticket.id,
            priority: ticket.priority,
            status: ticket.status,
            subject: ticket.subject
          }))}
        />
      </CardContent>
    </Card>
  );
}
