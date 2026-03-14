import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Account, BillPayment } from "@/types";
import { writeAuditLog } from "@/utils/audit";

const bodySchema = z.object({
  amount_pence: z.number().int().positive(),
  bill_payment_id: z.string().uuid(),
  from_account_id: z.string().uuid(),
  payment_date: z.string().min(1),
  reference: z.string().trim().max(18).optional()
});

function getNextPaymentDate(paymentDate: string, frequency: BillPayment["frequency"]) {
  const baseDate = new Date(paymentDate);

  if (frequency === "monthly") {
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + 1,
      baseDate.getDate()
    )
      .toISOString()
      .slice(0, 10);
  }

  if (frequency === "weekly") {
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + 7);

    return nextDate.toISOString().slice(0, 10);
  }

  return null;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid payment request.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const {
    amount_pence,
    bill_payment_id,
    from_account_id,
    payment_date,
    reference
  } = parsed.data;
  const ipAddress = getRequestIp(request);

  const [{ data: accountData }, { data: billPaymentData }] = await Promise.all([
    admin.from("accounts").select("*").eq("id", from_account_id).maybeSingle(),
    admin
      .from("bill_payments")
      .select("*")
      .eq("id", bill_payment_id)
      .maybeSingle()
  ]);

  const account = (accountData ?? null) as Account | null;
  const billPayment = (billPaymentData ?? null) as BillPayment | null;

  if (!account || account.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  if (!billPayment || billPayment.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  if (account.balance_pence < amount_pence) {
    return jsonError("Insufficient funds", 400);
  }

  const nextPaymentDate = getNextPaymentDate(payment_date, billPayment.frequency);
  const nextIsActive = billPayment.frequency !== "one_off";
  let transactionId: string | null = null;
  let accountDebited = false;

  try {
    const { error: debitError } = await admin
      .from("accounts")
      .update({ balance_pence: account.balance_pence - amount_pence })
      .eq("id", account.id);

    if (debitError) {
      throw debitError;
    }

    accountDebited = true;

    const { data: transaction, error: transactionError } = await admin
      .from("transactions")
      .insert({
        account_id: account.id,
        amount_pence,
        description: `Bill payment - ${billPayment.payee_name}`,
        direction: "debit",
        reference: reference || null
      })
      .select("id")
      .single();

    if (transactionError || !transaction) {
      throw transactionError ?? new Error("transaction_insert_failed");
    }

    transactionId = transaction.id as string;

    const { error: scheduleError } = await admin
      .from("bill_payments")
      .update({
        is_active: nextIsActive,
        next_payment_date: nextPaymentDate
      })
      .eq("id", billPayment.id);

    if (scheduleError) {
      throw scheduleError;
    }

    await writeAuditLog(admin, {
      action: "bill_payment_made",
      actor_id: user.id,
      entity_id: billPayment.id,
      entity_type: "bill_payments",
      ip_address: ipAddress,
      metadata: {
        amount_pence,
        from_account_id: account.id,
        payee_name: billPayment.payee_name
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (transactionId) {
      await admin.from("transactions").delete().eq("id", transactionId);
    }

    if (accountDebited) {
      await admin
        .from("accounts")
        .update({ balance_pence: account.balance_pence })
        .eq("id", account.id);
    }

    logServerError("bill-pay.post", error);

    return jsonError("Payment failed. Please try again.", 500);
  }
}
