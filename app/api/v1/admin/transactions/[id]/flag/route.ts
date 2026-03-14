import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireRouteSession } from "@/lib/route-helpers";
import type { Account, Profile, Transaction } from "@/types";
import { writeAuditLog } from "@/utils/audit";

const bodySchema = z.object({
  customer_id: z.string().uuid().optional()
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { user } = sessionContext;
  const admin = getSupabaseAdminClient();

  const { data: actorProfileData } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const actorProfile = (actorProfileData ?? null) as Profile | null;

  if (!actorProfile || (actorProfile.role !== "staff" && actorProfile.role !== "admin")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }

  const { data: transactionData } = await admin
    .from("transactions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const transaction = (transactionData ?? null) as Transaction | null;

  if (!transaction) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: accountData } = await admin
    .from("accounts")
    .select("*")
    .eq("id", transaction.account_id)
    .maybeSingle();

  const account = (accountData ?? null) as Account | null;

  if (!account) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (
    parsed.data.customer_id &&
    parsed.data.customer_id !== account.user_id
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: existingFraudEvent } = await admin
    .from("fraud_events")
    .select("id")
    .eq("transaction_id", transaction.id)
    .maybeSingle();

  if (existingFraudEvent) {
    return NextResponse.json({
      already_flagged: true,
      success: true
    });
  }

  try {
    const { data: fraudEvent, error: insertFraudError } = await admin
      .from("fraud_events")
      .insert({
        status: "flagged",
        transaction_id: transaction.id,
        trigger_reason: "Manually flagged by staff",
        user_id: account.user_id
      })
      .select("id")
      .single();

    if (insertFraudError || !fraudEvent) {
      throw new Error("fraud_insert_failed");
    }

    await writeAuditLog(admin, {
      action: "transaction_flagged",
      actor_id: user.id,
      entity_id: transaction.id,
      entity_type: "transaction",
      metadata: {
        customer_id: account.user_id,
        fraud_event_id: fraudEvent.id
      }
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/fraud");
    revalidatePath(`/admin/customers/${account.user_id}`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Action failed. Please try again." },
      { status: 500 }
    );
  }
}
