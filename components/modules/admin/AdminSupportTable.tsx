"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAdminStatusLabel } from "@/lib/admin";
import type { TicketStatus } from "@/types";
import { formatRelative } from "@/utils/dates";

type SupportRow = {
  assigned_to: string | null;
  created_at: string;
  customer_name: string;
  id: string;
  priority: string;
  status: TicketStatus;
  subject: string;
};

function getPriorityBadgeClass(priority: string) {
  if (priority === "high") {
    return "bg-red-100 text-red-700";
  }

  if (priority === "low") {
    return "bg-slate-100 text-slate-600";
  }

  return "bg-amber-100 text-amber-700";
}

function getStatusBadgeClass(status: TicketStatus) {
  if (status === "resolved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "in_progress") {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-amber-100 text-amber-700";
}

export function AdminSupportTable({
  currentUserId,
  tickets
}: {
  currentUserId: string;
  tickets: SupportRow[];
}) {
  const [rows, setRows] = useState(tickets);
  const [activeFilter, setActiveFilter] = useState<TicketStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const filteredRows =
    activeFilter === "all"
      ? rows
      : rows.filter((row) => row.status === activeFilter);

  async function assignToMe(ticketId: string) {
    setBusyId(ticketId);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/v1/support/${ticketId}`, {
        body: JSON.stringify({ action: "assign_to_me" }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.error || "Unable to assign this ticket.");
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === ticketId
            ? { ...row, assigned_to: currentUserId, status: "in_progress" }
            : row
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(["all", "open", "in_progress", "resolved"] as const).map((value) => (
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
            {value === "all" ? "All" : formatAdminStatusLabel(value)}
          </button>
        ))}
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-100">
        <div className="hidden grid-cols-[110px_1fr_1.2fr_120px_120px_130px_180px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid">
          <span>Ref</span>
          <span>Customer</span>
          <span>Subject</span>
          <span>Priority</span>
          <span>Status</span>
          <span>Time</span>
          <span>Actions</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No tickets match this filter.
            </div>
          ) : (
            filteredRows.map((row) => (
              <div
                className="grid gap-4 px-4 py-4 lg:grid-cols-[110px_1fr_1.2fr_120px_120px_130px_180px] lg:items-center"
                key={row.id}
              >
                <div className="font-mono text-sm text-slate-500">
                  #{row.id.slice(-8)}
                </div>
                <div className="font-medium text-slate-950">{row.customer_name}</div>
                <div className="text-sm text-slate-600">{row.subject}</div>
                <Badge className={getPriorityBadgeClass(row.priority)}>
                  {formatAdminStatusLabel(row.priority)}
                </Badge>
                <Badge className={getStatusBadgeClass(row.status)}>
                  {formatAdminStatusLabel(row.status)}
                </Badge>
                <div className="text-sm text-slate-600">
                  {formatRelative(row.created_at)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" type="button" variant="outline">
                    <Link href={`/admin/support/${row.id}`}>View</Link>
                  </Button>
                  {row.status !== "resolved" && row.assigned_to !== currentUserId ? (
                    <Button
                      disabled={busyId === row.id}
                      onClick={() => void assignToMe(row.id)}
                      size="sm"
                      type="button"
                    >
                      Assign to me
                    </Button>
                  ) : null}
                  {row.assigned_to === currentUserId ? (
                    <Badge className="bg-sky-100 text-sky-700">
                      Assigned to you
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
