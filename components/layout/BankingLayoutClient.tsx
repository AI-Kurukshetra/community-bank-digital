"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  CreditCard,
  FileBadge2,
  FileText,
  Landmark,
  LayoutDashboard,
  LocateFixed,
  LogOut,
  PiggyBank,
  ReceiptText,
  Repeat2,
  ScrollText,
  ShieldAlert,
  UserRound,
  Wallet
} from "lucide-react";

import { FraudAlertBanner } from "@/components/layout/fraud-alert-banner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const bankingItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/accounts", icon: Wallet, label: "Accounts" },
  { href: "/transfers", icon: Repeat2, label: "Transfers" },
  { href: "/payments/bill-pay", icon: ReceiptText, label: "Pay Bills" },
  { href: "/cards", icon: CreditCard, label: "Cards" },
  { href: "/loans", icon: Landmark, label: "Loans" },
  { href: "/cheque-deposit", icon: ScrollText, label: "Deposit Cheque" },
  { href: "/statements", icon: FileText, label: "Statements" },
  { href: "/documents", icon: FileBadge2, label: "Documents" },
  { href: "/support", icon: ShieldAlert, label: "Help & Support" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "/budgeting", icon: PiggyBank, label: "Budgeting" },
  { href: "/locate", icon: LocateFixed, label: "Find Us" },
  { href: "/profile", icon: UserRound, label: "Profile" }
] as const;

export function BankingLayoutClient({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const supabase = getSupabaseBrowserClient();
  const { logout, profile, user } = useAuth();
  const [fraudCount, setFraudCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadFraudCount() {
      if (!user?.id) {
        setFraudCount(0);
        return;
      }

      const { count } = await supabase
        .from("fraud_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "flagged");

      setFraudCount(count ?? 0);
    }

    void loadFraudCount();
  }, [supabase, user?.id]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  const firstName = profile?.full_name.split(/\s+/)[0] || "Customer";
  const bankName = process.env.NEXT_PUBLIC_BANK_NAME || "Community Bank";

  return (
    <div className="banking-stage min-h-screen bg-[#f3f6fb] text-slate-950">
      <FraudAlertBanner count={fraudCount} />

      <aside className="fixed inset-y-0 left-0 hidden w-[240px] overflow-y-auto border-r border-white/60 bg-white/80 px-5 py-6 backdrop-blur-xl lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
          {bankName}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0A2540]">
          Digital Banking
        </h1>

        <nav className="mt-8 space-y-1">
          {bankingItems.map(({ href, icon: Icon, label }) => {
            const isActive =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(`${href}/`));

            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-[#0A2540] text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                )}
                href={href}
                key={href}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div
        className={cn(
          "min-h-screen px-4 pb-24 pt-6 sm:px-6 lg:ml-[240px] lg:px-8 lg:pb-10",
          fraudCount > 0 ? "lg:pt-20" : "lg:pt-6"
        )}
      >
        <header className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/65 bg-white/78 px-5 py-4 shadow-[0_24px_55px_rgba(45,60,132,0.1)] backdrop-blur-xl">
          <div>
            <p className="text-sm text-slate-500">Welcome, {firstName}</p>
          </div>

          <Button onClick={() => void handleLogout()} type="button" variant="outline">
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Signing out" : "Logout"}
          </Button>
        </header>

        <main className="mt-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {bankingItems.map(({ href, icon: Icon, label }) => {
            const isActive =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(`${href}/`));

            return (
              <Link
                className={cn(
                  "flex min-w-[92px] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium transition",
                  isActive
                    ? "bg-[#0A2540] text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                )}
                href={href}
                key={href}
              >
                <Icon className="h-4 w-4" />
                <span className="text-center leading-4">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
