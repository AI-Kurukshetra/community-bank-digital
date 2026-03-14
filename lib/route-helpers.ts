import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseRouteClient } from "@/lib/supabase-route";
import type { Profile, UserRole } from "@/types";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function logServerError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
}

export function internalServerError(scope: string, error: unknown) {
  logServerError(scope, error);

  return jsonError("Something went wrong. Please try again.", 500);
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  return forwardedFor?.split(",")[0]?.trim() || null;
}

export async function getSignedUrl(
  bucket: string,
  path: string
): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, 300);

  if (error || !data?.signedUrl) {
    throw new Error("signed_url_failed");
  }

  return data.signedUrl;
}

export async function requireRouteSession() {
  const supabase = createSupabaseRouteClient();
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
      response: jsonError("Unauthorized", 401)
    };
  }

  return {
    admin: getSupabaseAdminClient(),
    session,
    supabase,
    user
  };
}

export async function getUserProfile(userId: string) {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return (data ?? null) as Profile | null;
}

export async function requireRole(
  userId: string,
  allowedRoles: UserRole[]
) {
  const profile = await getUserProfile(userId);

  if (!profile || !allowedRoles.includes(profile.role)) {
    return {
      profile,
      response: jsonError("Forbidden", 403)
    };
  }

  return { profile };
}
