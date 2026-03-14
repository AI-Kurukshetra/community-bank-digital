import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { ensureStarterCustomerAccounts } from "@/lib/customer-provisioning";
import { logServerError } from "@/lib/route-helpers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { jsonError } from "@/lib/route-helpers";
import type { Profile } from "@/types";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

function getFullName(user: User, providedFullName?: string | null) {
  if (providedFullName?.trim()) {
    return providedFullName.trim();
  }

  if (
    user.user_metadata &&
    typeof user.user_metadata === "object" &&
    typeof user.user_metadata.full_name === "string" &&
    user.user_metadata.full_name.trim()
  ) {
    return user.user_metadata.full_name.trim();
  }

  if (user.email?.trim()) {
    return user.email.split("@")[0]!.trim();
  }

  return "Customer";
}

export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();
  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    return jsonError("Unauthorized", 401);
  }

  const { data: userData, error: userError } = await admin.auth.getUser(
    bearerToken
  );

  if (userError || !userData.user) {
    return jsonError("Unauthorized", 401);
  }

  const user = userData.user;
  const existingProfileResponse = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileResponse.error) {
    return NextResponse.json(
      { error: "Unable to load your account." },
      { status: 500 }
    );
  }

  if (existingProfileResponse.data) {
    await ensureStarterCustomerAccounts(admin, user.id).catch((error) => {
      logServerError("auth.bootstrap_profile.ensure_accounts", error);
    });

    return NextResponse.json(existingProfileResponse.data);
  }

  const body = await request.json().catch(() => ({}));
  const providedFullName =
    typeof body.full_name === "string" ? body.full_name : null;

  const { data: insertedProfile, error: insertError } = await admin
    .from("profiles")
    .insert({
      full_name: getFullName(user, providedFullName),
      id: user.id,
      role: "customer",
      status: "active"
    })
    .select("id, role")
    .single();

  if (insertError) {
    const retryResponse = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (retryResponse.data) {
      return NextResponse.json(retryResponse.data);
    }

    return NextResponse.json(
      { error: "Unable to create your account profile." },
      { status: 500 }
    );
  }

  await ensureStarterCustomerAccounts(admin, user.id).catch((error) => {
    logServerError("auth.bootstrap_profile.ensure_accounts", error);
  });

  return NextResponse.json(insertedProfile as Pick<Profile, "id" | "role">);
}
