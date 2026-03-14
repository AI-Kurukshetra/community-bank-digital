"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";

export function RoleGuard({
  allowedRoles,
  children,
  fallback = null
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isLoading, role } = useAuth();

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
