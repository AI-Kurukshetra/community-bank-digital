"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Eye, ImageOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatAdminStatusLabel,
  getCheckStatusBadgeClass
} from "@/lib/admin";
import type { CheckStatus } from "@/types";
import { formatGBP } from "@/utils/currency";
import { formatRelative } from "@/utils/dates";
import { maskAccountNumber } from "@/utils/maskAccount";

type ChequeReviewRow = {
  account_number: string;
  amount_pence: number | null;
  created_at: string;
  customer_name: string;
  id: string;
  preview_url: string | null;
  rejection_reason: string | null;
  status: CheckStatus;
};

export function ChequeReviewTable({
  items
}: {
  items: ChequeReviewRow[];
}) {
  const [rows, setRows] = useState(items);
  const [activeFilter, setActiveFilter] = useState<CheckStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const countByStatus = useMemo(
    () =>
      rows.reduce<Record<CheckStatus, number>>(
        (counts, row) => {
          counts[row.status] += 1;
          return counts;
        },
        {
          pending: 0,
          processing: 0,
          processed: 0,
          rejected: 0
        }
      ),
    [rows]
  );

  const filteredRows = useMemo(() => {
    if (activeFilter === "all") {
      return rows;
    }

    return rows.filter((row) => row.status === activeFilter);
  }, [activeFilter, rows]);

  const filterOptions: Array<{
    count: number;
    label: string;
    value: CheckStatus | "all";
  }> = [
    { count: rows.length, label: "All", value: "all" },
    {
      count: countByStatus.pending,
      label: formatAdminStatusLabel("pending"),
      value: "pending"
    },
    {
      count: countByStatus.processing,
      label: formatAdminStatusLabel("processing"),
      value: "processing"
    },
    {
      count: countByStatus.processed,
      label: formatAdminStatusLabel("processed"),
      value: "processed"
    },
    {
      count: countByStatus.rejected,
      label: formatAdminStatusLabel("rejected"),
      value: "rejected"
    }
  ];

  async function handleReview(id: string, action: "approve" | "reject") {
    const reason = reasonById[id]?.trim();

    if (action === "reject" && !reason) {
      setErrorMessage("Enter a rejection reason before rejecting this cheque.");
      return;
    }

    setBusyId(id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/v1/cheque/${id}`, {
        body: JSON.stringify({
          action,
          reason: action === "reject" ? reason : undefined
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        rejection_reason?: string;
        status?: CheckStatus;
      };

      if (!response.ok) {
        setErrorMessage(payload.error || "Cheque review failed.");
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? {
                ...row,
                rejection_reason:
                  action === "reject"
                    ? payload.rejection_reason ?? reason ?? row.rejection_reason
                    : null,
                status: payload.status ?? (action === "approve" ? "processed" : "rejected")
              }
            : row
        )
      );
      setExpandedId((current) => (current === id ? null : current));
      setRejectingId((current) => (current === id ? null : current));
      setResultMessage(
        payload.message ||
          (action === "approve"
            ? "Cheque approved."
            : "Cheque rejected.")
      );
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
        No cheque deposits are available in the review listing.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeFilter === option.value
                  ? "bg-[#0A2540] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              type="button"
            >
              <span>{option.label}</span>
              <span
                className={`ml-2 inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                  activeFilter === option.value
                    ? "bg-white/15 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {option.count}
              </span>
            </button>
          ))}
        </div>

        <p className="text-sm text-slate-500">
          Showing {filteredRows.length} of {rows.length} cheque deposits in the
          review listing.
        </p>
      </div>

      {resultMessage ? (
        <p className="text-sm text-emerald-600">{resultMessage}</p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-100">
        <div className="hidden grid-cols-[1.1fr_160px_140px_120px_120px_220px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid">
          <span>Customer</span>
          <span>Account</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Time</span>
          <span>Actions</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No cheques match this filter.
            </div>
          ) : (
            filteredRows.map((row) => {
              const isExpanded = expandedId === row.id;
              const isRejecting = rejectingId === row.id;

              return (
                <div key={row.id}>
                  <div className="grid gap-4 px-4 py-4 md:grid-cols-[1.1fr_160px_140px_120px_120px_220px] md:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                        Customer
                      </p>
                      <p className="font-medium text-slate-950">{row.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                        Account
                      </p>
                      <p className="text-sm text-slate-600">
                        {maskAccountNumber(row.account_number)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                        Amount
                      </p>
                      <p className="text-sm font-medium text-slate-950">
                        {row.amount_pence === null ? "-" : formatGBP(row.amount_pence)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                        Status
                      </p>
                      <Badge className={getCheckStatusBadgeClass(row.status)}>
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          setExpandedId((current) => (current === row.id ? null : row.id))
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </Button>
                      {row.status === "pending" ? (
                        <>
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={busyId === row.id}
                            onClick={() => void handleReview(row.id, "approve")}
                            size="sm"
                            type="button"
                          >
                            Approve
                          </Button>
                          <Button
                            disabled={busyId === row.id}
                            onClick={() =>
                              setRejectingId((current) => (current === row.id ? null : row.id))
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {(isExpanded || isRejecting) && (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4">
                      {isExpanded ? (
                        row.preview_url ? (
                          <div className="relative h-[380px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <Image
                              alt={`Cheque ${row.id}`}
                              className="object-contain"
                              fill
                              sizes="100vw"
                              src={row.preview_url}
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                            <ImageOff className="h-4 w-4" />
                            Preview unavailable
                          </div>
                        )
                      ) : null}

                      <div className="mt-4 rounded-2xl border border-white/80 bg-white/85 px-4 py-4 text-sm text-slate-600">
                        {row.status === "pending" ? (
                          <p>
                            Approving this cheque credits the selected account and
                            posts a matching credit transaction. Rejecting keeps
                            funds on hold and stores the customer-facing reason.
                          </p>
                        ) : row.status === "processed" ? (
                          <p>
                            This cheque was approved and credited to the customer
                            account.
                          </p>
                        ) : (
                          <p>
                            Rejection reason:{" "}
                            <span className="font-medium text-slate-950">
                              {row.rejection_reason ?? "No reason recorded."}
                            </span>
                          </p>
                        )}
                      </div>

                      {isRejecting ? (
                        <div className="mt-4 space-y-3">
                          <label className="block text-sm font-medium text-slate-700">
                            Rejection reason
                          </label>
                          <textarea
                            className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
                            onChange={(event) =>
                              setReasonById((current) => ({
                                ...current,
                                [row.id]: event.target.value
                              }))
                            }
                            placeholder="Explain why the cheque is being rejected"
                            value={reasonById[row.id] ?? ""}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="bg-red-600 hover:bg-red-700"
                              disabled={busyId === row.id}
                              onClick={() => void handleReview(row.id, "reject")}
                              type="button"
                            >
                              Submit rejection
                            </Button>
                            <Button
                              disabled={busyId === row.id}
                              onClick={() => setRejectingId(null)}
                              type="button"
                              variant="outline"
                            >
                              Cancel
                            </Button>
                            {busyId === row.id ? (
                              <Badge className="bg-slate-100 text-slate-600">
                                Working
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
