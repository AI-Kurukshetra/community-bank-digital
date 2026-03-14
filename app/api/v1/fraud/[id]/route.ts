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
import type { FraudEvent } from "@/types";
import { writeAuditLog } from "@/utils/audit";
import { sendEmail } from "@/utils/notifications";

const bodySchema = z.object({
  action: z.enum(["confirm", "dismiss"])
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
  const { data: fraudEventData } = await admin
    .from("fraud_events")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const fraudEvent = (fraudEventData ?? null) as FraudEvent | null;

  if (!fraudEvent) {
    return jsonError("Not found.", 404);
  }

  if (fraudEvent.status !== "flagged") {
    return jsonError("Already reviewed", 400);
  }

  try {
    let responsePayload:
      | {
          cards_frozen: number;
          message: string;
          status: "confirmed";
          success: true;
          support_ticket_id: string | null;
        }
      | {
          message: string;
          status: "dismissed";
          success: true;
        };

    if (parsed.data.action === "confirm") {
      const { error: confirmError } = await admin
        .from("fraud_events")
        .update({
          reviewed_by: user.id,
          status: "confirmed"
        })
        .eq("id", fraudEvent.id);

      if (confirmError) {
        throw confirmError;
      }

      const { data: activeCards } = await admin
        .from("cards")
        .select("id")
        .eq("user_id", fraudEvent.user_id)
        .eq("status", "active");

      const activeCardCount = (activeCards ?? []).length;
      const { error: freezeCardsError } = await admin
        .from("cards")
        .update({ status: "frozen" })
        .eq("user_id", fraudEvent.user_id)
        .eq("status", "active");

      if (freezeCardsError) {
        throw freezeCardsError;
      }

      const { data: customerData } = await admin.auth.admin.getUserById(
        fraudEvent.user_id
      );

      if (customerData.user?.email) {
        await sendEmail(
          customerData.user.email,
          "Fraud alert confirmed",
          "We confirmed suspicious activity and froze all active cards on your profile."
        );
      }

      let supportTicketId: string | null = null;

      try {
        const { data: supportTicket } = await admin
          .from("support_tickets")
          .insert({
            body: [
              "Category: Fraud",
              `Fraud event: ${fraudEvent.id}`,
              fraudEvent.transaction_id
                ? `Transaction: ${fraudEvent.transaction_id}`
                : null,
              "",
              fraudEvent.trigger_reason ??
                "Confirmed suspicious activity. Contact the customer and arrange replacement card support if required."
            ]
              .filter(Boolean)
              .join("\n"),
            priority: "high",
            subject: "Urgent fraud follow-up",
            user_id: fraudEvent.user_id
          })
          .select("id")
          .single();

        supportTicketId = (supportTicket?.id as string | undefined) ?? null;
      } catch (supportError) {
        logServerError("fraud.patch.support_ticket", supportError);
      }

      await writeAuditLog(admin, {
        action: "fraud_confirmed",
        actor_id: user.id,
        entity_id: fraudEvent.id,
        entity_type: "fraud_events",
        ip_address: ipAddress,
        metadata: {
          cards_frozen: activeCardCount,
          customer_id: fraudEvent.user_id,
          support_ticket_id: supportTicketId
        }
      });

      responsePayload = {
        cards_frozen: activeCardCount,
        message: supportTicketId
          ? `Fraud confirmed. ${activeCardCount} active card${activeCardCount === 1 ? "" : "s"} frozen and support case #${supportTicketId.slice(-8)} opened.`
          : `Fraud confirmed. ${activeCardCount} active card${activeCardCount === 1 ? "" : "s"} frozen.`,
        status: "confirmed",
        success: true,
        support_ticket_id: supportTicketId
      };
    } else {
      const { error: dismissError } = await admin
        .from("fraud_events")
        .update({
          reviewed_by: user.id,
          status: "dismissed"
        })
        .eq("id", fraudEvent.id);

      if (dismissError) {
        throw dismissError;
      }

      await writeAuditLog(admin, {
        action: "fraud_dismissed",
        actor_id: user.id,
        entity_id: fraudEvent.id,
        entity_type: "fraud_events",
        ip_address: ipAddress
      });

      responsePayload = {
        message: "Fraud alert dismissed. No customer action was triggered.",
        status: "dismissed",
        success: true
      };
    }

    revalidatePath("/support");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/fraud");
    revalidatePath("/admin/support");
    revalidatePath(`/admin/fraud/${fraudEvent.id}`);
    revalidatePath(`/admin/customers/${fraudEvent.user_id}`);

    return NextResponse.json(responsePayload);

  } catch (error) {
    logServerError("fraud.patch", error);

    return jsonError("Action failed. Please try again.", 500);
  }
}
