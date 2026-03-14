import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

type AppSupabaseClient = SupabaseClient;

let browserClient: AppSupabaseClient | undefined;

export function getSupabaseBrowserClient(): AppSupabaseClient {
  browserClient ??= createClientComponentClient({
    supabaseKey: getSupabaseAnonKey(),
    supabaseUrl: getSupabaseUrl()
  });

  return browserClient;
}
