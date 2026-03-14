"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  LayoutDashboard,
  ShieldAlert,
  Ticket,
  Users
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/layout/logout-button";
import { useAuth } from "@/hooks/useAuth";
import { getAdminRoleBadgeClass, getAdminRoleLabel } from "@/lib/admin";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const navItems = [
  {
    badgeColor: "",
    badgeKey: null,
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    label: "Overview"
  },
  {
    badgeColor: "",
    badgeKey: null,
    href: "/admin/customers",
    icon: Users,
    label: "Customers"
  },
  {
    badgeColor: "bg-red-100 text-red-700",
    badgeKey: "fraud",
    href: "/admin/fraud",
    icon: ShieldAlert,
    label: "Fraud Alerts"
  },
  {
    badgeColor: "bg-amber-100 text-amber-700",
    badgeKey: "cheques",
    href: "/admin/cheques",
    icon: CheckSquare,
    label: "Cheque Review"
  },
  {
    badgeColor: "",
    badgeKey: null,
    href: "/admin/support",
    icon: Ticket,
    label: "Support Tickets"
  }
] as const;

export function AdminShellClient({
  children,
  initialCounts,
  initialFullName,
  initialRole
}: {
  children: React.ReactNode;
  initialCounts: {
    cheques: number;
    fraud: number;
  };
  initialFullName: string;
  initialRole: UserRole;
}) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const displayFullName = profile?.full_name ?? initialFullName;
  const displayRole = profile?.role ?? initialRole;

  return (
    <div className="banking-stage min-h-screen bg-[#f3f6fb]">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] overflow-y-auto border-r border-white/60 bg-white/80 px-5 py-6 backdrop-blur-xl lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
          Operations
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0A2540]">
          Admin Console
        </h1>

        <nav className="mt-8 space-y-1">
          {navItems.map(({ badgeColor, badgeKey, href, icon: Icon, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);
            const count = badgeKey ? initialCounts[badgeKey] : 0;

            return (
              <Link
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-[#0A2540] text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                )}
                href={href}
                key={href}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                {badgeKey && count > 0 ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", badgeColor)}>
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-screen px-4 py-6 sm:px-6 lg:ml-[240px] lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/65 bg-white/78 px-5 py-4 shadow-[0_24px_55px_rgba(45,60,132,0.1)] backdrop-blur-xl">
          <div className="space-y-1">
            <p className="font-medium text-slate-950">{displayFullName}</p>
            <Badge className={getAdminRoleBadgeClass(displayRole)}>
              {getAdminRoleLabel(displayRole)}
            </Badge>
          </div>
          <LogoutButton />
        </header>

        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}
