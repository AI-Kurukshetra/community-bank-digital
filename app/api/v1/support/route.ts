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
import type { Account } from "@/types";
import { writeAuditLog } from "@/utils/audit";
import { maskAccountNumber } from "@/utils/maskAccount";

const categories = [
  "Payments",
  "Cards",
  "Fraud",
  "Statements",
  "Profile",
  "Other"
] as const;

const bodySchema = z.object({
  body: z.string().trim().min(20).max(2500),
  category: z.enum(categories),
  related_account_id: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional(),
  subject: z.string().trim().min(5).max(120)
});

function getPriority(category: (typeof categories)[number], body: string) {
  const normalizedBody = body.toLowerCase();

  if (
    category === "Fraud" ||
    normalizedBody.includes("fraud") ||
    normalizedBody.includes("unauthor") ||
    normalizedBody.includes("scam") ||
    normalizedBody.includes("stolen")
  ) {
    return "high";
  }

  if (category === "Payments" || category === "Cards") {
    return "medium";
  }

  if (category === "Statements" || category === "Profile") {
    return "low";
  }

  return "medium";
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid support ticket request.", 400);
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { admin, user } = sessionContext;
  const roleContext = await requireRole(user.id, ["customer"]);

  if ("response" in roleContext) {
    return roleContext.response;
  }

  const ipAddress = getRequestIp(request);
  const relatedAccountId = parsed.data.related_account_id?.trim() || null;
  let relatedAccount: Account | null = null;

  if (relatedAccountId) {
    const { data: accountData } = await admin
      .from("accounts")
      .select("*")
      .eq("id", relatedAccountId)
      .maybeSingle();

    relatedAccount = (accountData ?? null) as Account | null;

    if (!relatedAccount || relatedAccount.user_id !== user.id) {
      return jsonError("Invalid account selection.", 400);
    }
  }

  const priority = getPriority(parsed.data.category, parsed.data.body);
  const composedBody = [
    `Category: ${parsed.data.category}`,
    relatedAccount
      ? `Account: ${maskAccountNumber(relatedAccount.account_number)}`
      : null,
    "",
    parsed.data.body
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { data: supportTicket, error } = await admin
      .from("support_tickets")
      .insert({
        body: composedBody,
        priority,
        subject: parsed.data.subject,
        user_id: user.id
      })
      .select("id")
      .single();

    if (error || !supportTicket) {
      throw error ?? new Error("support_ticket_insert_failed");
    }

    await writeAuditLog(admin, {
      action: "support_ticket_created",
      actor_id: user.id,
      entity_id: supportTicket.id as string,
      entity_type: "support_tickets",
      ip_address: ipAddress,
      metadata: {
        category: parsed.data.category,
        priority,
        related_account_id: relatedAccount?.id ?? null
      }
    });

    revalidatePath("/support");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/support");
    revalidatePath(`/admin/customers/${user.id}`);

    return NextResponse.json({
      priority,
      reference: (supportTicket.id as string).slice(-8),
      success: true,
      ticket_id: supportTicket.id as string
    });
  } catch (error) {
    logServerError("support.post", error);

    return jsonError("Unable to submit this request right now.", 500);
  }
}
