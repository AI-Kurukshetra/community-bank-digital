import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRequestIp,
  jsonError,
  logServerError,
  requireRouteSession
} from "@/lib/route-helpers";
import type { Card as BankCard } from "@/types";
import { writeAuditLog } from "@/utils/audit";
import { sendEmail } from "@/utils/notifications";

const bodySchema = z
  .object({
    daily_limit_pence: z.number().int().nonnegative().max(50000).optional(),
    status: z.enum(["active", "frozen", "cancelled"]).optional()
  })
  .refine(
    (value) =>
      value.status !== undefined || value.daily_limit_pence !== undefined,
    { message: "At least one field is required." }
  );

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid update request.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const ipAddress = getRequestIp(request);
  const { data: cardData } = await admin
    .from("cards")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const card = (cardData ?? null) as BankCard | null;

  if (!card || card.user_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  if (card.status === "cancelled") {
    return jsonError("Card is cancelled", 400);
  }

  const updates: Partial<Pick<BankCard, "daily_limit_pence" | "status">> = {};

  if (parsed.data.status) {
    updates.status = parsed.data.status;
  }

  if (parsed.data.daily_limit_pence !== undefined) {
    updates.daily_limit_pence = parsed.data.daily_limit_pence;
  }

  let action = "card_limit_changed";

  if (parsed.data.status === "frozen") {
    action = "card_frozen";
  } else if (parsed.data.status === "active") {
    action = "card_unfrozen";
  } else if (parsed.data.status === "cancelled") {
    action = "card_cancelled";
  }

  try {
    const { error } = await admin.from("cards").update(updates).eq("id", card.id);

    if (error) {
      throw error;
    }

    await writeAuditLog(admin, {
      action,
      actor_id: user.id,
      entity_id: card.id,
      entity_type: "cards",
      ip_address: ipAddress,
      metadata: {
        daily_limit_pence: updates.daily_limit_pence ?? null,
        status: updates.status ?? null
      }
    });

    if (updates.status === "cancelled" && user.email) {
      await sendEmail(
        user.email,
        "Card cancelled",
        `Your card ending ${card.masked_number.slice(-4)} has been cancelled. Contact your branch for a replacement.`
      );
    }

    revalidatePath("/cards");
    revalidatePath(`/cards/${card.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError("cards.patch", error);

    return jsonError("Update failed. Please try again.", 500);
  }
}
