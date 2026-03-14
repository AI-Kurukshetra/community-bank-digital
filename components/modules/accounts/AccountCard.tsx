import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getAccountTypeLabel } from "@/lib/banking";
import { cn } from "@/lib/utils";
import { formatGBP } from "@/utils/currency";
import { maskAccountNumber, maskSortCode } from "@/utils/maskAccount";
import type { Account } from "@/types";

const accountThemes: Record<
  Account["type"],
  {
    badge: string;
    surface: string;
  }
> = {
  current: {
    badge: "bg-white/18 text-white/88",
    surface:
      "bg-[linear-gradient(135deg,#2849ff_0%,#596bff_55%,#f277b0_100%)]"
  },
  savings: {
    badge: "bg-white/18 text-white/88",
    surface:
      "bg-[linear-gradient(135deg,#123a86_0%,#227ad9_52%,#87d8ff_100%)]"
  },
  isa: {
    badge: "bg-white/18 text-white/88",
    surface:
      "bg-[linear-gradient(135deg,#2c2360_0%,#5d4fd6_50%,#cf7bff_100%)]"
  }
};

export function AccountCard({ account }: { account: Account }) {
  const theme = accountThemes[account.type];

  return (
    <Link className="group block h-full" href={`/accounts/${account.id}`}>
      <Card className="h-full overflow-hidden border-0 bg-transparent shadow-none">
        <CardContent
          className={cn(
            "relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-[1.9rem] p-6 text-white shadow-[0_30px_90px_rgba(78,58,164,0.22)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_36px_110px_rgba(78,58,164,0.28)]",
            theme.surface
          )}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-white/18 blur-2xl" />
            <div className="absolute -left-14 bottom-2 h-28 w-28 rounded-full bg-[#10002c]/16 blur-2xl" />
          </div>

          <div className="relative flex items-start justify-between gap-4">
            <div className="space-y-4">
              <span
                className={cn(
                  "inline-flex rounded-full border border-white/16 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] backdrop-blur",
                  theme.badge
                )}
              >
                {getAccountTypeLabel(account.type)}
              </span>
              <p className="text-lg font-semibold tracking-[0.14em] text-white/92">
                {maskAccountNumber(account.account_number)}
              </p>
            </div>

            <div className="rounded-full border border-white/18 bg-white/14 p-2 text-white/85 backdrop-blur">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="relative space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/68">
              Available balance
            </p>
            <p className="text-4xl font-semibold tracking-tight text-white">
              {formatGBP(account.balance_pence)}
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-3 py-2 text-sm text-white/82 backdrop-blur">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  account.is_active ? "bg-emerald-300" : "bg-white/60"
                )}
              />
              Sort code {maskSortCode(account.sort_code)}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
