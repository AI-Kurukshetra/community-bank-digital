import type { AdminUserAttributes } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hasOnlyStarterCustomerAccounts } from "@/lib/customer-provisioning";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireRouteSession } from "@/lib/route-helpers";
import type { Profile } from "@/types";
import { writeAuditLog } from "@/utils/audit";

const statusSchema = z.enum(["active", "suspended"]);

const updateCustomerSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address.").optional(),
    full_name: z.string().trim().min(2, "Enter the customer's full name.").optional(),
    phone: z
      .union([z.string().trim().max(30, "Phone number is too long."), z.literal(""), z.null()])
      .optional(),
    status: statusSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Invalid request."
  });

function isEmailConflict(message: string | undefined) {
  const normalizedMessage = message?.toLowerCase() ?? "";

  return normalizedMessage.includes("already") || normalizedMessage.includes("exists");
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const parsed = updateCustomerSchema.safeParse(
    await request.json().catch(() => null)
  );

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

  const { data: customerProfileData } = await admin
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .eq("role", "customer")
    .maybeSingle();

  const customerProfile = (customerProfileData ?? null) as Profile | null;

  if (!customerProfile) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const { data: customerAuthData, error: customerAuthError } =
    await admin.auth.admin.getUserById(customerProfile.id);

  if (customerAuthError || !customerAuthData.user) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const normalizedEmail = parsed.data.email?.toLowerCase();
  const normalizedPhone =
    parsed.data.phone === undefined
      ? undefined
      : typeof parsed.data.phone === "string"
        ? parsed.data.phone.trim() || null
        : null;

  const authUpdates: AdminUserAttributes = {};
  const profileUpdates: Partial<Profile> = {};
  const changedFields: string[] = [];
  const currentUserMetadata =
    customerAuthData.user.user_metadata &&
    typeof customerAuthData.user.user_metadata === "object"
      ? { ...(customerAuthData.user.user_metadata as Record<string, unknown>) }
      : {};

  if (
    normalizedEmail &&
    normalizedEmail !== (customerAuthData.user.email ?? "").toLowerCase()
  ) {
    authUpdates.email = normalizedEmail;
    changedFields.push("email");
  }

  if (
    parsed.data.full_name !== undefined &&
    parsed.data.full_name !== customerProfile.full_name
  ) {
    authUpdates.user_metadata = {
      ...currentUserMetadata,
      full_name: parsed.data.full_name
    };
    profileUpdates.full_name = parsed.data.full_name;
    changedFields.push("full_name");
  }

  if (normalizedPhone !== undefined && normalizedPhone !== customerProfile.phone) {
    profileUpdates.phone = normalizedPhone;
    changedFields.push("phone");
  }

  if (parsed.data.status && parsed.data.status !== customerProfile.status) {
    profileUpdates.status = parsed.data.status;
    changedFields.push("status");
  }

  if (changedFields.length === 0) {
    return NextResponse.json({ success: true });
  }

  let authWasUpdated = false;

  try {
    if (Object.keys(authUpdates).length > 0) {
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(
        customerProfile.id,
        authUpdates
      );

      if (updateAuthError) {
        return NextResponse.json(
          {
            error: isEmailConflict(updateAuthError.message)
              ? "An account with this email already exists."
              : "Unable to update customer."
          },
          {
            status: isEmailConflict(updateAuthError.message) ? 409 : 500
          }
        );
      }

      authWasUpdated = true;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateProfileError } = await admin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", customerProfile.id);

      if (updateProfileError) {
        throw new Error("profile_update_failed");
      }
    }

    await writeAuditLog(admin, {
      action: "admin_customer_updated",
      actor_id: user.id,
      entity_id: customerProfile.id,
      entity_type: "profile",
      metadata: {
        changed_fields: changedFields
      }
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${customerProfile.id}`);

    return NextResponse.json({ success: true });
  } catch {
    if (authWasUpdated) {
      const rollbackAuthUpdates: AdminUserAttributes = {};

      if ("email" in authUpdates) {
        rollbackAuthUpdates.email = customerAuthData.user.email ?? undefined;
      }

      if ("user_metadata" in authUpdates) {
        rollbackAuthUpdates.user_metadata = currentUserMetadata;
      }

      if (Object.keys(rollbackAuthUpdates).length > 0) {
        await admin.auth.admin
          .updateUserById(customerProfile.id, rollbackAuthUpdates)
          .catch(() => null);
      }
    }

    return NextResponse.json(
      { error: "Unable to update customer." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

  const { data: customerProfileData } = await admin
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .eq("role", "customer")
    .maybeSingle();

  const customerProfile = (customerProfileData ?? null) as Profile | null;

  if (!customerProfile) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const customerProfileId = customerProfile.id;

  const { data: customerAccountsData } = await admin
    .from("accounts")
    .select("id, account_number, type, sort_code, balance_pence, is_active, created_at")
    .eq("user_id", customerProfileId);

  const customerAccounts =
    (customerAccountsData ?? []) as Array<{
      account_number: string;
      balance_pence: number;
      created_at: string;
      id: string;
      is_active: boolean;
      sort_code: string;
      type: "current" | "savings" | "isa";
    }>;
  const accountIds = customerAccounts.map((account) => account.id);
  const hasOnlyStarterAccounts = hasOnlyStarterCustomerAccounts(
    customerAccounts.map((account) => ({
      balance_pence: account.balance_pence,
      is_active: account.is_active,
      sort_code: account.sort_code,
      type: account.type
    }))
  );

  const [{ data: customerAuthData }, ...countResults] = await Promise.all([
    admin.auth.admin.getUserById(customerProfileId),
    admin
      .from("beneficiaries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    admin
      .from("bill_payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    admin
      .from("fraud_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", customerProfileId),
    admin
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    admin
      .from("loans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    admin
      .from("alert_configs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    admin
      .from("check_images")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerProfileId),
    accountIds.length > 0
      ? admin
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .in("account_id", accountIds)
      : Promise.resolve({ count: 0 }),
    accountIds.length > 0
      ? admin
          .from("statements")
          .select("id", { count: "exact", head: true })
          .in("account_id", accountIds)
      : Promise.resolve({ count: 0 })
  ]);

  const linkedRecordsCount = countResults.reduce(
    (total, result) => total + (result.count ?? 0),
    0
  );

  if (linkedRecordsCount > 0 || (accountIds.length > 0 && !hasOnlyStarterAccounts)) {
    return NextResponse.json(
      {
        error:
          "This customer has linked banking records and cannot be deleted. Suspend the profile instead."
      },
      { status: 400 }
    );
  }

  if (accountIds.length > 0) {
    const { error: deleteAccountsError } = await admin
      .from("accounts")
      .delete()
      .in("id", accountIds);

    if (deleteAccountsError) {
      return NextResponse.json(
        { error: "Unable to delete customer." },
        { status: 500 }
      );
    }
  }

  async function restoreDeletedAccounts() {
    if (customerAccounts.length === 0) {
      return;
    }

    await admin.from("accounts").insert(
      customerAccounts.map((account) => ({
        account_number: account.account_number,
        balance_pence: account.balance_pence,
        created_at: account.created_at,
        id: account.id,
        is_active: account.is_active,
        sort_code: account.sort_code,
        type: account.type,
        user_id: customerProfileId
      }))
    );
  }

  const { error: deleteProfileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", customerProfileId);

  if (deleteProfileError) {
    await restoreDeletedAccounts().catch(() => null);

    return NextResponse.json(
      { error: "Unable to delete customer." },
      { status: 500 }
    );
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(
    customerProfileId
  );

  if (deleteAuthError) {
    await admin.from("profiles").insert({
      created_at: customerProfile.created_at,
      full_name: customerProfile.full_name,
      id: customerProfileId,
      phone: customerProfile.phone,
      role: customerProfile.role,
      status: customerProfile.status
    });
    await restoreDeletedAccounts().catch(() => null);

    return NextResponse.json(
      { error: "Unable to delete customer." },
      { status: 500 }
    );
  }

  await writeAuditLog(admin, {
      action: "admin_customer_deleted",
      actor_id: user.id,
      entity_id: customerProfileId,
      entity_type: "profile",
      metadata: {
        email: customerAuthData.user?.email ?? null
    }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerProfileId}`);

  return NextResponse.json({ success: true });
}
