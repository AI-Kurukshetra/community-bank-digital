import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureStarterCustomerAccounts } from "@/lib/customer-provisioning";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logServerError, requireRouteSession } from "@/lib/route-helpers";
import type { Profile } from "@/types";
import { writeAuditLog } from "@/utils/audit";

const statusSchema = z.enum(["active", "suspended"]);

const createCustomerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  full_name: z.string().trim().min(2, "Enter the customer's full name."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/\d/, "Password must contain at least one number."),
  phone: z.string().trim().max(30, "Phone number is too long.").optional(),
  status: statusSchema.optional()
});

function isEmailConflict(message: string | undefined) {
  const normalizedMessage = message?.toLowerCase() ?? "";

  return normalizedMessage.includes("already") || normalizedMessage.includes("exists");
}

export async function POST(request: Request) {
  const parsed = createCustomerSchema.safeParse(
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

  const normalizedEmail = parsed.data.email.toLowerCase();
  const normalizedPhone = parsed.data.phone?.trim() || null;
  const status = parsed.data.status ?? "active";

  const { data: createdUserData, error: createUserError } =
    await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      password: parsed.data.password,
      user_metadata: {
        full_name: parsed.data.full_name
      }
    });

  if (createUserError || !createdUserData.user) {
    return NextResponse.json(
      {
        error: isEmailConflict(createUserError?.message)
          ? "An account with this email already exists."
          : "Unable to create customer."
      },
      {
        status: isEmailConflict(createUserError?.message) ? 409 : 500
      }
    );
  }

  const createdUser = createdUserData.user;
  const { error: insertProfileError } = await admin.from("profiles").insert({
    full_name: parsed.data.full_name,
    id: createdUser.id,
    phone: normalizedPhone,
    role: "customer",
    status
  });

  if (insertProfileError) {
    await admin.auth.admin.deleteUser(createdUser.id).catch(() => null);

    return NextResponse.json(
      { error: "Unable to create customer." },
      { status: 500 }
    );
  }

  await ensureStarterCustomerAccounts(admin, createdUser.id).catch((error) => {
    logServerError("admin.customers.create.ensure_accounts", error);
  });

  await writeAuditLog(admin, {
    action: "admin_customer_created",
    actor_id: user.id,
    entity_id: createdUser.id,
    entity_type: "profile",
    metadata: {
      email: normalizedEmail,
      status
    }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/customers");

  return NextResponse.json({ id: createdUser.id, success: true });
}
