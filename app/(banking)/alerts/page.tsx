"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  Lock,
  PoundSterling,
  ShieldAlert,
  Timer,
  Wallet
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { AlertConfig } from "@/types";
import { poundsToPence, penceToPounds } from "@/utils/currency";

type AlertState = {
  days_before: number;
  is_active: boolean;
  threshold_pence: number;
};

const ALERT_ROWS = [
  {
    defaultDays: 0,
    defaultThreshold: 10_000,
    hasDays: false,
    hasThreshold: true,
    icon: Wallet,
    label: "Low balance",
    locked: false,
    type: "low_balance"
  },
  {
    defaultDays: 0,
    defaultThreshold: 50_000,
    hasDays: false,
    hasThreshold: true,
    icon: PoundSterling,
    label: "Large transaction",
    locked: false,
    type: "large_transaction"
  },
  {
    defaultDays: 0,
    defaultThreshold: 0,
    hasDays: false,
    hasThreshold: false,
    icon: Lock,
    label: "New device login",
    locked: true,
    type: "new_device_login"
  },
  {
    defaultDays: 0,
    defaultThreshold: 0,
    hasDays: false,
    hasThreshold: false,
    icon: Globe,
    label: "Card used abroad",
    locked: false,
    type: "card_used_abroad"
  },
  {
    defaultDays: 3,
    defaultThreshold: 0,
    hasDays: true,
    hasThreshold: false,
    icon: Timer,
    label: "Payment due",
    locked: false,
    type: "payment_due"
  },
  {
    defaultDays: 0,
    defaultThreshold: 0,
    hasDays: false,
    hasThreshold: false,
    icon: ShieldAlert,
    label: "Fraud alert",
    locked: true,
    type: "fraud_flagged"
  }
] as const;

export default function AlertsPage() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const [alerts, setAlerts] = useState<Record<string, AlertState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAlerts() {
      if (!user?.id) {
        return;
      }

      const { data } = await supabase
        .from("alert_configs")
        .select("*")
        .eq("user_id", user.id);

      const configs = (data ?? []) as AlertConfig[];
      const nextAlerts: Record<string, AlertState> = {};

      for (const row of ALERT_ROWS) {
        const existing = configs.find((config) => config.type === row.type);
        nextAlerts[row.type] = {
          days_before: existing?.days_before ?? row.defaultDays,
          is_active: existing ? existing.is_active : row.locked ? true : false,
          threshold_pence: existing?.threshold_pence ?? row.defaultThreshold
        };
      }

      setAlerts(nextAlerts);
      setLoading(false);
    }

    void loadAlerts();
  }, [supabase, user?.id]);

  function toggleAlert(type: string) {
    setAlerts((current) => ({
      ...current,
      [type]: {
        ...current[type],
        is_active: !current[type].is_active
      }
    }));
  }

  function updateThreshold(type: string, value: string) {
    const pounds = Number(value || "0");

    setAlerts((current) => ({
      ...current,
      [type]: {
        ...current[type],
        threshold_pence: Number.isFinite(pounds) ? poundsToPence(pounds) : 0
      }
    }));
  }

  function updateDays(type: string, value: string) {
    setAlerts((current) => ({
      ...current,
      [type]: {
        ...current[type],
        days_before: Number.parseInt(value || "0", 10)
      }
    }));
  }

  async function handleSave() {
    if (!user?.id || saving) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/v1/alerts", {
        body: JSON.stringify(
          ALERT_ROWS.filter((row) => !row.locked).map((row) => ({
            days_before: row.hasDays ? alerts[row.type]?.days_before ?? row.defaultDays : null,
            is_active: alerts[row.type]?.is_active ?? false,
            threshold_pence: row.hasThreshold
              ? alerts[row.type]?.threshold_pence ?? row.defaultThreshold
              : null,
            type: row.type
          }))
        ),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      setMessage(response.ok ? "Alert preferences saved." : "Failed to save preferences.");
    } catch {
      setMessage("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3047ff] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="banking-panel p-6">
        <div>
          <p className="banking-chip">Notifications</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Alerts
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Configure which notifications you receive.
          </p>
        </div>
      </section>

      <div className="space-y-3">
        {ALERT_ROWS.map((row) => {
          const state = alerts[row.type];
          const Icon = row.icon;
          const isActive = row.locked ? true : state?.is_active;

          return (
            <div
              className="flex items-center gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-5 py-4"
              key={row.type}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-950">{row.label}</p>
                  {row.locked ? <Lock className="h-3.5 w-3.5 text-slate-400" /> : null}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {row.hasThreshold ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-500">Threshold GBP</span>
                      <input
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        disabled={!isActive}
                        min="0"
                        onChange={(event) => updateThreshold(row.type, event.target.value)}
                        step="1"
                        type="number"
                        value={penceToPounds(
                          state?.threshold_pence ?? row.defaultThreshold
                        )}
                      />
                    </div>
                  ) : null}

                  {row.hasDays ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-500">Days before</span>
                      <input
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        disabled={!isActive}
                        max="30"
                        min="1"
                        onChange={(event) => updateDays(row.type, event.target.value)}
                        type="number"
                        value={state?.days_before ?? row.defaultDays}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {row.locked ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Always on
                </span>
              ) : (
                <button
                  className={`relative h-7 w-12 rounded-full transition ${
                    isActive ? "bg-[#3047ff]" : "bg-slate-200"
                  }`}
                  onClick={() => toggleAlert(row.type)}
                  type="button"
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                      isActive ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <Button
          className="rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
          disabled={saving}
          onClick={() => void handleSave()}
          type="button"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
        {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
      </div>
    </div>
  );
}
