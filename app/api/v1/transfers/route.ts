import { NextResponse } from "next/server";
import { z } from "zod";

import { TRANSFER_LIMITS } from "@/constants/transferLimits";
import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Account, Beneficiary } from "@/types";
import { writeAuditLog } from "@/utils/audit";
import { maskAccountNumber } from "@/utils/maskAccount";

const bodySchema = z
  .object({
    amount_pence: z.number().int().positive(),
    beneficiary_id: z.string().uuid().optional(),
    from_account_id: z.string().uuid(),
    reference: z.string().trim().max(18).optional(),
    to_account_id: z.string().uuid().optional()
  })
  .refine(
    (value) => Boolean(value.to_account_id) !== Boolean(value.beneficiary_id),
    { message: "Exactly one destination is required." }
  );

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid transfer request.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const {
    amount_pence,
    beneficiary_id,
    from_account_id,
    reference: requestedReference,
    to_account_id
  } = parsed.data;
  const ipAddress = getRequestIp(request);

  const { data: fromAccountData } = await admin
    .from("accounts")
    .select("*")
    .eq("id", from_account_id)
    .maybeSingle();

  const fromAccount = (fromAccountData ?? null) as Account | null;

  if (!fromAccount || fromAccount.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  let destinationAccount: Account | null = null;
  let beneficiary: Beneficiary | null = null;

  if (to_account_id) {
    const { data } = await admin
      .from("accounts")
      .select("*")
      .eq("id", to_account_id)
      .maybeSingle();

    destinationAccount = (data ?? null) as Account | null;

    if (!destinationAccount || destinationAccount.user_id !== user.id) {
      return jsonError("Forbidden", 403);
    }

    if (destinationAccount.id === fromAccount.id) {
      return jsonError("Select a different destination account.", 400);
    }
  }

  if (beneficiary_id) {
    const { data } = await admin
      .from("beneficiaries")
      .select("*")
      .eq("id", beneficiary_id)
      .maybeSingle();

    beneficiary = (data ?? null) as Beneficiary | null;

    if (!beneficiary || beneficiary.user_id !== user.id) {
      return jsonError("Forbidden", 403);
    }
  }

  if (fromAccount.balance_pence < amount_pence) {
    return jsonError("Insufficient funds", 400);
  }

  const { data: userAccountsData } = await admin
    .from("accounts")
    .select("id")
    .eq("user_id", user.id);

  const userAccountIds = (userAccountsData ?? []).map((account) => account.id as string);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  let todaysDebits = 0;

  if (userAccountIds.length > 0) {
    const { data: debitRows } = await admin
      .from("transactions")
      .select("amount_pence")
      .in("account_id", userAccountIds)
      .eq("direction", "debit")
      .gte("created_at", startOfDay.toISOString())
      .lt("created_at", endOfDay.toISOString());

    todaysDebits = (debitRows ?? []).reduce(
      (sum, row) => sum + Number(row.amount_pence ?? 0),
      0
    );
  }

  if (todaysDebits + amount_pence > TRANSFER_LIMITS.DAILY_LIMIT) {
    return jsonError("Daily limit reached", 400);
  }

  const reference = `TRF-${Date.now().toString(36).toUpperCase()}`;
  const description = beneficiary?.name ?? "Own account transfer";
  let debitApplied = false;
  let creditApplied = false;
  let debitTransactionId: string | null = null;
  let creditTransactionId: string | null = null;

  try {
    const { error: debitError } = await admin
      .from("accounts")
      .update({ balance_pence: fromAccount.balance_pence - amount_pence })
      .eq("id", fromAccount.id);

    if (debitError) {
      throw new Error("debit_update_failed");
    }

    debitApplied = true;

    if (destinationAccount) {
      const { error: creditError } = await admin
        .from("accounts")
        .update({
          balance_pence: destinationAccount.balance_pence + amount_pence
        })
        .eq("id", destinationAccount.id);

      if (creditError) {
        throw new Error("credit_update_failed");
      }

      creditApplied = true;
    }

    const { data: debitTransaction, error: debitTransactionError } = await admin
      .from("transactions")
      .insert({
        account_id: fromAccount.id,
        amount_pence,
        description,
        direction: "debit",
        reference: requestedReference || reference
      })
      .select("id")
      .single();

    if (debitTransactionError || !debitTransaction) {
      throw new Error("debit_transaction_failed");
    }

    debitTransactionId = debitTransaction.id as string;

    if (destinationAccount) {
      const { data: creditTransaction, error: creditTransactionError } =
        await admin
          .from("transactions")
          .insert({
            account_id: destinationAccount.id,
            amount_pence,
            description: `Transfer from ${maskAccountNumber(
              fromAccount.account_number
            )}`,
            direction: "credit",
            reference: requestedReference || reference
          })
          .select("id")
          .single();

      if (creditTransactionError || !creditTransaction) {
        throw new Error("credit_transaction_failed");
      }

      creditTransactionId = creditTransaction.id as string;
    }

    await writeAuditLog(admin, {
      action: "transfer_completed",
      actor_id: user.id,
      entity_id: fromAccount.id,
      entity_type: "accounts",
      ip_address: ipAddress,
      metadata: {
        amount_pence,
        beneficiary_id: beneficiary?.id ?? null,
        destination_account_id: destinationAccount?.id ?? null,
        reference,
        user_reference: requestedReference || null
      }
    });

    return NextResponse.json({ reference });
  } catch (error) {
    if (creditTransactionId) {
      await admin.from("transactions").delete().eq("id", creditTransactionId);
    }

    if (debitTransactionId) {
      await admin.from("transactions").delete().eq("id", debitTransactionId);
    }

    if (creditApplied && destinationAccount) {
      await admin
        .from("accounts")
        .update({ balance_pence: destinationAccount.balance_pence })
        .eq("id", destinationAccount.id);
    }

    if (debitApplied) {
      await admin
        .from("accounts")
        .update({ balance_pence: fromAccount.balance_pence })
        .eq("id", fromAccount.id);
    }

    await writeAuditLog(admin, {
      action: "transfer_failed",
      actor_id: user.id,
      entity_id: fromAccount.id,
      entity_type: "accounts",
      ip_address: ipAddress,
      metadata: {
        amount_pence,
        beneficiary_id: beneficiary?.id ?? null,
        destination_account_id: destinationAccount?.id ?? null
      }
    });

    logServerError("transfers.post", error);

    return jsonError("Transfer failed. Please try again.", 500);
  }
}
