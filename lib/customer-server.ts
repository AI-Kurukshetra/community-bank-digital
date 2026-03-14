import { redirect } from "next/navigation";

import { ensureStarterCustomerAccounts } from "@/lib/customer-provisioning";
import { logServerError } from "@/lib/route-helpers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Profile } from "@/types";

export async function requireCustomerServerSession() {
  const supabase = createSupabaseServerClient();
  const [
    {
      data: { session }
    },
    {
      data: { user }
    }
  ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  if (!session || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "customer") {
    redirect("/admin/dashboard");
  }

  await ensureStarterCustomerAccounts(getSupabaseAdminClient(), user.id).catch(
    (error) => {
      logServerError("customer_session.ensure_accounts", error);
    }
  );

  return {
    profile: profile as Profile,
    supabase,
    user
  };
}
