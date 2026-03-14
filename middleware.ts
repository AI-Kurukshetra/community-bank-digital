import { NextResponse, type NextRequest } from "next/server";

import { getHomePathForRole } from "@/lib/auth-core";
import { createSupabaseMiddlewareClient } from "@/lib/supabase-middleware";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/accounts",
  "/transfers",
  "/payments",
  "/cards",
  "/loans",
  "/messages",
  "/statements",
  "/documents",
  "/alerts",
  "/support",
  "/locate",
  "/budgeting",
  "/cheque-deposit",
  "/profile",
  "/admin"
];
const AUTH_PAGES = [
  "/login",
  "/register",
  "/forgot-password"
];
const RETIRED_MFA_PAGES = ["/setup-mfa", "/verify-mfa"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthPage(pathname: string) {
  return AUTH_PAGES.includes(pathname);
}

function isRetiredMfaPage(pathname: string) {
  return RETIRED_MFA_PAGES.includes(pathname);
}

function redirect(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next();
  const supabase = createSupabaseMiddlewareClient(request, response);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    if (isProtectedPath(pathname) || isRetiredMfaPage(pathname)) {
      return redirect(request, "/login");
    }

    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;
  const homePath = getHomePathForRole(role);

  if (isRetiredMfaPage(pathname)) {
    return redirect(request, homePath);
  }

  if (role === "customer" && pathname.startsWith("/admin")) {
    return redirect(request, "/dashboard");
  }

  if (isAuthPage(pathname)) {
    return redirect(request, homePath);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
