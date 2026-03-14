import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

export function createSupabaseServerClient() {
  return createServerComponentClient(
    { cookies },
    {
      supabaseKey: getSupabaseAnonKey(),
      supabaseUrl: getSupabaseUrl()
    }
  );
}
