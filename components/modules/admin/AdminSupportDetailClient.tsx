"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdminStatusLabel } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import type { SupportTicket } from "@/types";
import { formatDate } from "@/utils/dates";

function getPriorityBadgeClass(priority: string) {
  if (priority === "high") {
    return "bg-red-100 text-red-700";
  }

  if (priority === "low") {
    return "bg-slate-100 text-slate-600";
  }

  return "bg-amber-100 text-amber-700";
}

function getStatusBadgeClass(status: SupportTicket["status"]) {
  if (status === "resolved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "in_progress") {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-amber-100 text-amber-700";
}

export function AdminSupportDetailClient({
  customerName,
  ticket
}: {
  customerName: string;
  ticket: SupportTicket;
}) {
  const [status, setStatus] = useState(ticket.status);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function updateStatus(nextStatus: "in_progress" | "resolved") {
    setIsSavingStatus(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/v1/support/${ticket.id}`, {
        body: JSON.stringify({
          action: "update_status",
          status: nextStatus
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.error || "Unable to update this ticket.");
        return;
      }

      setStatus(nextStatus);
    } finally {
      setIsSavingStatus(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <BackButton fallbackHref="/admin/support" label="Back to support" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ticket.subject}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Reference
            </p>
            <p className="mt-1 font-mono text-sm text-slate-700">
              #{ticket.id.slice(-8)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Customer
            </p>
            <p className="mt-1 font-medium text-slate-950">{customerName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Priority
            </p>
            <div className="mt-1">
              <Badge className={getPriorityBadgeClass(ticket.priority)}>
                {formatAdminStatusLabel(ticket.priority)}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Created
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {formatDate(ticket.created_at)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Request details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Original request
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                {ticket.body}
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              Direct ticket replies have been removed from this build. Use the
              status controls to track and resolve the request.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Current status
              </p>
              <div className="mt-2">
                <Badge className={getStatusBadgeClass(status)}>
                  {formatAdminStatusLabel(status)}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Update status
              </label>
              <select
                className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
                disabled={isSavingStatus}
                onChange={(event) => {
                  const nextStatus = event.target.value;

                  if (nextStatus === "open") {
                    return;
                  }

                  void updateStatus(nextStatus as "in_progress" | "resolved");
                }}
                value={status}
              >
                {status === "open" ? <option value="open">Open</option> : null}
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {errorMessage ? (
              <p className="text-sm text-red-600">{errorMessage}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
