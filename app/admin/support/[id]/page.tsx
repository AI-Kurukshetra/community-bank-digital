import { notFound } from "next/navigation";

import { AdminSupportDetailClient } from "@/components/modules/admin/AdminSupportDetailClient";
import { getAdminServerContext } from "@/lib/admin-server";
import type { Profile, SupportTicket } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminSupportDetailPage({
  params
}: {
  params: { id: string };
}) {
  const context = await getAdminServerContext();

  if (!context) {
    return null;
  }

  const { admin } = context;
  const { data: ticketData } = await admin
    .from("support_tickets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const ticket = (ticketData ?? null) as SupportTicket | null;

  if (!ticket) {
    notFound();
  }

  const { data: customerData } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("id", ticket.user_id)
    .maybeSingle();

  const customer = (customerData ?? null) as Pick<Profile, "id" | "full_name"> | null;

  return (
    <AdminSupportDetailClient
      customerName={customer?.full_name ?? "Unknown customer"}
      ticket={ticket}
    />
  );
}
