import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRole,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Account, CheckImage } from "@/types";
import { writeAuditLog } from "@/utils/audit";
import { sendEmail } from "@/utils/notifications";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid request.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const roleContext = await requireRole(user.id, ["staff", "admin"]);

  if ("response" in roleContext) {
    return roleContext.response;
  }

  const ipAddress = getRequestIp(request);
  const { data: chequeData } = await admin
    .from("check_images")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const cheque = (chequeData ?? null) as CheckImage | null;

  if (!cheque) {
    return jsonError("Not found.", 404);
  }

  if (cheque.status !== "pending") {
    return jsonError("Already reviewed", 400);
  }

  const [{ data: accountData }, { data: customerData }] = await Promise.all([
    admin.from("accounts").select("*").eq("id", cheque.account_id).maybeSingle(),
    admin.auth.admin.getUserById(cheque.user_id)
  ]);

  const account = (accountData ?? null) as Account | null;

  if (!account) {
    return jsonError("Not found.", 404);
  }

  try {
    let responsePayload:
      | {
          credited_amount_pence: number;
          message: string;
          status: "processed";
          success: true;
          transaction_id: string | null;
        }
      | {
          message: string;
          rejection_reason: string;
          status: "rejected";
          success: true;
        };

    if (parsed.data.action === "approve") {
      if (!cheque.amount_pence || cheque.amount_pence <= 0) {
        return jsonError("Cheque amount is missing.", 400);
      }

      const { error: chequeError } = await admin
        .from("check_images")
        .update({ status: "processed" })
        .eq("id", cheque.id);

      if (chequeError) {
        throw chequeError;
      }

      const { error: creditError } = await admin
        .from("accounts")
        .update({ balance_pence: account.balance_pence + cheque.amount_pence })
        .eq("id", account.id);

      if (creditError) {
        throw creditError;
      }

      const { data: transactionData, error: transactionError } = await admin
        .from("transactions")
        .insert({
          account_id: account.id,
          amount_pence: cheque.amount_pence,
          category: "transfer",
          description: "Cheque deposit",
          direction: "credit",
          reference: null
        })
        .select("id")
        .single();

      if (transactionError) {
        throw transactionError;
      }

      if (customerData.user?.email) {
        await sendEmail(
          customerData.user.email,
          "Cheque approved",
          "Your cheque deposit has been approved and credited to your account."
        );
      }

      await writeAuditLog(admin, {
        action: "cheque_approved",
        actor_id: user.id,
        entity_id: cheque.id,
        entity_type: "check_images",
        ip_address: ipAddress
      });

      responsePayload = {
        credited_amount_pence: cheque.amount_pence,
        message: `Cheque approved. ${cheque.amount_pence ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(cheque.amount_pence / 100) : "Funds"} credited to the customer account and posted to transactions.`,
        status: "processed",
        success: true,
        transaction_id: (transactionData?.id as string | undefined) ?? null
      };
    } else {
      if (!parsed.data.reason?.trim()) {
        return jsonError("A rejection reason is required.", 400);
      }

      const { error: rejectError } = await admin
        .from("check_images")
        .update({
          rejection_reason: parsed.data.reason.trim(),
          status: "rejected"
        })
        .eq("id", cheque.id);

      if (rejectError) {
        throw rejectError;
      }

      if (customerData.user?.email) {
        await sendEmail(
          customerData.user.email,
          "Cheque rejected",
          `Your cheque deposit was rejected: ${parsed.data.reason.trim()}`
        );
      }

      await writeAuditLog(admin, {
        action: "cheque_rejected",
        actor_id: user.id,
        entity_id: cheque.id,
        entity_type: "check_images",
        ip_address: ipAddress,
        metadata: {
          reason: parsed.data.reason.trim()
        }
      });

      responsePayload = {
        message: "Cheque rejected. The customer has been notified and the rejection reason was recorded.",
        rejection_reason: parsed.data.reason.trim(),
        status: "rejected",
        success: true
      };
    }

    revalidatePath("/admin/cheques");
    revalidatePath("/cheque-deposit");
    revalidatePath("/dashboard");
    revalidatePath(`/admin/customers/${cheque.user_id}`);

    return NextResponse.json(responsePayload);
  } catch (error) {
    logServerError("cheque.patch", error);

    return jsonError("Action failed. Please try again.", 500);
  }
}
