import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getHomePathForRole } from "@/lib/auth-core";
import type { Profile } from "@/types";

export async function getServerAuthState() {
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
    return {
      homePath: "/login",
      profile: null,
      role: null,
      session: null,
      user: null
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    homePath: getHomePathForRole((profile as Profile | null)?.role),
    profile: (profile ?? null) as Profile | null,
    role: (profile?.role ?? null) as Profile["role"] | null,
    session,
    user
  };
}
