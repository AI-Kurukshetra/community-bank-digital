import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

export function createSupabaseRouteClient() {
  return createRouteHandlerClient(
    { cookies },
    {
      supabaseKey: getSupabaseAnonKey(),
      supabaseUrl: getSupabaseUrl()
    }
  );
}
