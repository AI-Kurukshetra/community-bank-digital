import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Account, Transaction } from "@/types";
import { writeAuditLog } from "@/utils/audit";

const bodySchema = z.object({
  reason: z.string().trim().min(10),
  transaction_id: z.string().uuid()
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid stop payment request.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const { reason, transaction_id } = parsed.data;
  const ipAddress = getRequestIp(request);
  const { data: transactionData } = await admin
    .from("transactions")
    .select("*")
    .eq("id", transaction_id)
    .maybeSingle();

  const transaction = (transactionData ?? null) as Transaction | null;

  if (!transaction) {
    return jsonError("Not found.", 404);
  }

  const { data: accountData } = await admin
    .from("accounts")
    .select("*")
    .eq("id", transaction.account_id)
    .maybeSingle();

  const account = (accountData ?? null) as Account | null;

  if (!account || account.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  try {
    const { data: supportTicket, error } = await admin
      .from("support_tickets")
      .insert({
        body: `Transaction: ${transaction.id}\nReason: ${reason}`,
        priority: "high",
        subject: "Stop Payment Request",
        user_id: user.id
      })
      .select("id")
      .single();

    if (error || !supportTicket) {
      throw error ?? new Error("support_ticket_insert_failed");
    }

    await writeAuditLog(admin, {
      action: "stop_payment_requested",
      actor_id: user.id,
      entity_id: supportTicket.id as string,
      entity_type: "support_tickets",
      ip_address: ipAddress,
      metadata: {
        transaction_id: transaction.id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("stop-payment.post", error);

    return jsonError("Unable to submit this request right now.", 500);
  }
}
