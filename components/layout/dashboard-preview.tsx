import Link from "next/link";
import {
  ArrowRightLeft,
  ShieldCheck,
  Sparkles,
  WalletCards
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatGBP } from "@/utils/currency";

const highlights = [
  {
    description: "Balances, cards, and payments laid out as one premium workspace.",
    icon: WalletCards,
    title: "Account overview"
  },
  {
    description: "Fast transfers and bill payments surfaced as first-class actions.",
    icon: ArrowRightLeft,
    title: "Move money"
  },
  {
    description: "Fraud review and customer support flows built into the platform shape.",
    icon: ShieldCheck,
    title: "Security layer"
  }
];

const previewBalancePence = 1_684_567;
const previewCreditsPence = 240_000;
const previewBillPence = 8_500;

export function DashboardPreview() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
      <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="banking-panel relative overflow-hidden p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-[#6f78ff]/16 blur-3xl" />
            <div className="absolute right-0 top-8 h-36 w-36 rounded-full bg-[#f477ad]/16 blur-3xl" />
          </div>

          <div className="relative space-y-6">
            <span className="banking-chip">
              <Sparkles className="mr-2 inline h-3.5 w-3.5 text-[#4156ff]" />
              Community Bank Digital
            </span>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                A sharper digital banking dashboard, inspired by modern fintech
                control surfaces.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-500">
                Sign in to the redesigned customer app and move through
                balances, transfers, cards, and fraud-aware actions from one
                cohesive interface.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-[1.4rem] px-6">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild className="rounded-[1.4rem] px-6" variant="outline">
                <Link href="/register">Create account</Link>
              </Button>
            </div>
            <div className="grid gap-3 pt-2">
              {highlights.map(({ title, description, icon: Icon }) => (
                <article
                  className="rounded-[1.5rem] border border-white/65 bg-white/70 px-4 py-4 shadow-[0_20px_50px_rgba(86,78,170,0.08)]"
                  key={title}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#2f48ff]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-950">{title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.2rem] border border-white/55 bg-[linear-gradient(145deg,#1c2c92_0%,#4556ff_48%,#f178b1_100%)] p-6 text-white shadow-[0_40px_120px_rgba(70,63,158,0.26)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-4 left-4 h-24 w-24 rounded-full bg-[#ffd5e7]/20 blur-3xl" />
          </div>

          <div className="relative space-y-5">
            <div className="rounded-[1.7rem] border border-white/20 bg-white/12 p-5 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/64">
                Total balance
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">
                {formatGBP(previewBalancePence)}
              </p>
              <p className="mt-2 text-sm text-white/72">
                Across current, savings, and card-linked activity.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/16 bg-white/12 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/62">
                  Recent credits
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {formatGBP(previewCreditsPence)}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/16 bg-white/12 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/62">
                  Card status
                </p>
                <p className="mt-3 text-2xl font-semibold">Protected</p>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-white/18 bg-white text-slate-950">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                  Recent activity
                </p>
              </div>
              <div className="space-y-3 px-5 py-5">
                <div className="flex items-center justify-between gap-4 rounded-[1.2rem] bg-[#f3f4ff] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Today
                    </p>
                    <p className="mt-1 font-semibold">Salary payment</p>
                  </div>
                  <p className="font-semibold text-emerald-600">
                    +{formatGBP(previewCreditsPence)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[1.2rem] bg-[#fff1f5] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Yesterday
                    </p>
                    <p className="mt-1 font-semibold">British Gas</p>
                  </div>
                  <p className="font-semibold text-rose-500">
                    -{formatGBP(previewBillPence)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
