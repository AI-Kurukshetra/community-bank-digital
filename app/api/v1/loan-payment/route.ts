import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Account, Loan } from "@/types";
import { writeAuditLog } from "@/utils/audit";

const bodySchema = z.object({
  amount_pence: z.number().int().positive(),
  from_account_id: z.string().uuid(),
  loan_id: z.string().uuid()
});

function getNextMonthDate(value: string | null) {
  const baseDate = value ? new Date(value) : new Date();
  const nextDate = new Date(baseDate);
  nextDate.setMonth(nextDate.getMonth() + 1);

  return nextDate.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid loan payment request.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const { amount_pence, from_account_id, loan_id } = parsed.data;
  const ipAddress = getRequestIp(request);
  const [{ data: loanData }, { data: accountData }] = await Promise.all([
    admin.from("loans").select("*").eq("id", loan_id).maybeSingle(),
    admin.from("accounts").select("*").eq("id", from_account_id).maybeSingle()
  ]);

  const loan = (loanData ?? null) as Loan | null;
  const account = (accountData ?? null) as Account | null;

  if (!loan || loan.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  if (!account || account.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  if (account.balance_pence < amount_pence) {
    return jsonError("Insufficient funds", 400);
  }

  let accountDebited = false;
  let loanUpdated = false;
  const nextLoanBalance = Math.max(0, loan.balance_pence - amount_pence);

  try {
    const { error: accountError } = await admin
      .from("accounts")
      .update({ balance_pence: account.balance_pence - amount_pence })
      .eq("id", account.id);

    if (accountError) {
      throw accountError;
    }

    accountDebited = true;

    const { error: loanError } = await admin
      .from("loans")
      .update({
        balance_pence: nextLoanBalance,
        next_payment_date:
          nextLoanBalance <= 0 ? null : getNextMonthDate(loan.next_payment_date),
        status: nextLoanBalance <= 0 ? "paid_off" : loan.status
      })
      .eq("id", loan.id);

    if (loanError) {
      throw loanError;
    }

    loanUpdated = true;

    const { error: transactionError } = await admin.from("transactions").insert({
      account_id: account.id,
      amount_pence,
      description: "Loan payment",
      direction: "debit",
      reference: null
    });

    if (transactionError) {
      throw transactionError;
    }

    await writeAuditLog(admin, {
      action: "loan_payment_made",
      actor_id: user.id,
      entity_id: loan.id,
      entity_type: "loans",
      ip_address: ipAddress,
      metadata: {
        amount_pence,
        from_account_id: account.id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (loanUpdated) {
      await admin
        .from("loans")
        .update({
          balance_pence: loan.balance_pence,
          next_payment_date: loan.next_payment_date,
          status: loan.status
        })
        .eq("id", loan.id);
    }

    if (accountDebited) {
      await admin
        .from("accounts")
        .update({ balance_pence: account.balance_pence })
        .eq("id", account.id);
    }

    logServerError("loan-payment.post", error);

    return jsonError("Payment failed. Please try again.", 500);
  }
}
