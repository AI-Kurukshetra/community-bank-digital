"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  formatAdminStatusLabel,
  getFraudStatusBadgeClass
} from "@/lib/admin";
import type { FraudStatus } from "@/types";
import { formatRelative } from "@/utils/dates";
import { FraudReviewActions } from "@/components/modules/admin/FraudReviewActions";

type FraudRow = {
  created_at: string;
  customer_name: string;
  id: string;
  status: FraudStatus;
  trigger_reason: string | null;
};

export function FraudTableClient({ fraudEvents }: { fraudEvents: FraudRow[] }) {
  const [rows, setRows] = useState(fraudEvents);
  const [activeFilter, setActiveFilter] = useState<FraudStatus | "all">("flagged");

  const filteredRows = useMemo(() => {
    if (activeFilter === "all") {
      return rows;
    }

    return rows.filter((row) => row.status === activeFilter);
  }, [activeFilter, rows]);

  function updateRowStatus(id: string, status: Exclude<FraudStatus, "flagged">) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, status } : row))
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fraud alerts</CardTitle>
        <CardDescription>
          Review and resolve suspicious activity flagged across the bank.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {(["all", "flagged", "confirmed", "dismissed"] as const).map((value) => (
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeFilter === value
                  ? "bg-[#0A2540] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              key={value}
              onClick={() => setActiveFilter(value)}
              type="button"
            >
              {value === "all"
                ? "All"
                : formatAdminStatusLabel(value)}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-slate-100">
          <div className="hidden grid-cols-[1.2fr_1.6fr_120px_140px_220px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid">
            <span>Customer</span>
            <span>Reason</span>
            <span>Status</span>
            <span>Time</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => (
                <div
                  className="grid gap-4 px-4 py-4 md:grid-cols-[1.2fr_1.6fr_120px_140px_220px] md:items-center"
                  key={row.id}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Customer
                    </p>
                    <p className="font-medium text-slate-950">{row.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Reason
                    </p>
                    <p className="text-sm text-slate-600">
                      {row.trigger_reason ?? "No reason provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Status
                    </p>
                    <Badge className={getFraudStatusBadgeClass(row.status)}>
                      {formatAdminStatusLabel(row.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Time
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatRelative(row.created_at)}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {row.status === "flagged" ? (
                      <FraudReviewActions
                        fraudEventId={row.id}
                        initialStatus={row.status}
                        onReviewed={(status) => updateRowStatus(row.id, status)}
                      />
                    ) : null}
                    <Link
                      className="inline-flex text-sm font-medium text-[#0A2540]"
                      href={`/admin/fraud/${row.id}`}
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No fraud alerts match this filter.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
