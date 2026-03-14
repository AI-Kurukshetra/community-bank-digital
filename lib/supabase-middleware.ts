import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import type { NextRequest, NextResponse } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createMiddlewareClient({
    req: request,
    res: response
  }, {
    supabaseKey: getSupabaseAnonKey(),
    supabaseUrl: getSupabaseUrl()
  });
}
