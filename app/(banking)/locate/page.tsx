"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MapPin, Phone, Wifi, WifiOff } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { ATM, Branch } from "@/types";
import { haversineDistance } from "@/utils/distance";

type Tab = "atms" | "branches";

function getDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function getTodayHours(openingHours: Branch["opening_hours"]) {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short" })
    .format(new Date())
    .toLowerCase();

  if (!openingHours) {
    return "Hours unavailable";
  }

  if (day === "sat") {
    return openingHours.sat ?? "Closed";
  }

  if (day === "sun") {
    return openingHours.sun ?? "Closed";
  }

  return openingHours.mon_fri ?? "Closed";
}

export default function LocatePage() {
  const supabase = getSupabaseBrowserClient();
  const [tab, setTab] = useState<Tab>("atms");
  const [atms, setAtms] = useState<(ATM & { distance?: number })[]>([]);
  const [branches, setBranches] = useState<(Branch & { distance?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoResolved, setGeoResolved] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoResolved(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGeoResolved(true);
      },
      () => {
        setUserLocation(null);
        setGeoResolved(true);
      }
    );
  }, []);

  useEffect(() => {
    async function loadLocations() {
      const [{ data: atmData }, { data: branchData }] = await Promise.all([
        supabase.from("atms").select("*"),
        supabase.from("branches").select("*")
      ]);

      const nextAtms = (atmData ?? []) as ATM[];
      const nextBranches = (branchData ?? []) as Branch[];

      if (userLocation) {
        setAtms(
          nextAtms
            .map((atm) => ({
              ...atm,
              distance: haversineDistance(userLocation.lat, userLocation.lng, atm.lat, atm.lng)
            }))
            .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
        );
        setBranches(
          nextBranches
            .map((branch) => ({
              ...branch,
              distance: haversineDistance(userLocation.lat, userLocation.lng, branch.lat, branch.lng)
            }))
            .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
        );
      } else {
        setAtms([...nextAtms].sort((a, b) => a.operator.localeCompare(b.operator)));
        setBranches([...nextBranches].sort((a, b) => a.name.localeCompare(b.name)));
      }

      setLoading(false);
    }

    if (!geoResolved) {
      return;
    }

    void loadLocations();
  }, [geoResolved, supabase, userLocation]);

  const activeItems = useMemo(() => (tab === "atms" ? atms : branches), [atms, branches, tab]);

  return (
    <div className="space-y-6">
      <section className="banking-panel p-6">
        <div>
          <p className="banking-chip">Nearby</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Find Us
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Locate ATMs and branches near you.
          </p>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === "atms"
                ? "bg-[#3047ff] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            onClick={() => setTab("atms")}
            type="button"
          >
            ATMs
          </button>
          <button
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === "branches"
                ? "bg-[#3047ff] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            onClick={() => setTab("branches")}
            type="button"
          >
            Branches
          </button>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3047ff] border-t-transparent" />
        </div>
      ) : activeItems.length === 0 ? (
        <Card className="banking-panel border-white/50 bg-white/70">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-slate-500">No locations found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tab === "atms"
            ? atms.map((atm) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-5 py-4"
                  key={atm.id}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">{atm.operator}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {atm.address}, {atm.postcode}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {atm.is_available ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <Wifi className="h-3 w-3" />
                            Available
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                            <WifiOff className="h-3 w-3" />
                            Unavailable
                          </span>
                        )}
                        {atm.distance !== undefined ? (
                          <span className="text-xs text-slate-400">{atm.distance.toFixed(1)} mi</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <a
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    href={getDirectionsUrl(atm.lat, atm.lng)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Get directions
                  </a>
                </div>
              ))
            : branches.map((branch) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/65 bg-white/65 px-5 py-4"
                  key={branch.id}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3047ff]">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">{branch.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {branch.address}, {branch.postcode}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {branch.phone ? (
                          <a
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-950"
                            href={`tel:${branch.phone}`}
                          >
                            <Phone className="h-3 w-3" />
                            {branch.phone}
                          </a>
                        ) : null}
                        <span className="text-xs text-slate-400">
                          Today: {getTodayHours(branch.opening_hours)}
                        </span>
                        {branch.distance !== undefined ? (
                          <span className="text-xs text-slate-400">{branch.distance.toFixed(1)} mi</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <a
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    href={getDirectionsUrl(branch.lat, branch.lng)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Get directions
                  </a>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
