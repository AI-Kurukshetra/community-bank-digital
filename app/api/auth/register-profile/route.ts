import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureStarterCustomerAccounts } from "@/lib/customer-provisioning";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logServerError } from "@/lib/route-helpers";
import { requireRouteSession } from "@/lib/route-helpers";

const bodySchema = z.object({
  full_name: z.string().min(2)
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const sessionContext = await requireRouteSession();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  const { user } = sessionContext;
  const admin = getSupabaseAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    await ensureStarterCustomerAccounts(admin, user.id).catch((error) => {
      logServerError("auth.register_profile.ensure_accounts", error);
    });

    return NextResponse.json({ success: true });
  }

  const { error } = await admin.from("profiles").insert({
    full_name: parsed.data.full_name,
    id: user.id,
    role: "customer"
  });

  if (error) {
    return NextResponse.json(
      { error: "Unable to create profile" },
      { status: 500 }
    );
  }

  await ensureStarterCustomerAccounts(admin, user.id).catch((provisionError) => {
    logServerError("auth.register_profile.ensure_accounts", provisionError);
  });

  return NextResponse.json({ success: true });
}
