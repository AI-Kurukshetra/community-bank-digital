import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Profile } from "@/types";

type AdminServerContext = {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  profile: Profile;
  supabase: ReturnType<typeof createSupabaseServerClient>;
  user: User;
};

export async function getAdminServerContext(): Promise<AdminServerContext | null> {
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

  const admin = getSupabaseAdminClient();
  const { data: profileData } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (profileData ?? null) as Profile | null;

  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    return null;
  }

  return {
    admin,
    profile,
    supabase,
    user
  };
}

export async function getAuthEmailByUserId(userId: string) {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);

  return data.user?.email ?? null;
}

export async function getAuthEmailMap(userIds: string[]) {
  const admin = getSupabaseAdminClient();
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);

      return [userId, data.user?.email ?? null] as const;
    })
  );

  return Object.fromEntries(entries) as Record<string, string | null>;
}
