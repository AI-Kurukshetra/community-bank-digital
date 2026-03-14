"use client";

import { startTransition, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CATEGORIES } from "@/constants/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useNavigationProgress } from "@/hooks/useNavigationProgress";

type DirectionFilter = "all" | "credit" | "debit";

export function AccountFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startNavigation } = useNavigationProgress();
  const direction = (searchParams.get("direction") ?? "all") as DirectionFilter;
  const category = searchParams.get("category") ?? "all";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const query = searchParams.get("query") ?? "";
  const categories = useMemo(() => ["all", ...CATEGORIES], []);

  function updateParam(key: string, value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (!value || value === "all") {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }

    nextParams.delete("page");

    startTransition(() => {
      startNavigation();
      router.replace(
        nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname
      );
    });
  }

  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur lg:grid-cols-[auto_auto_1fr_1fr_1.2fr]">
      <div className="space-y-2">
        <Label>Direction</Label>
        <div className="flex gap-2">
          {(["all", "credit", "debit"] as const).map((value) => (
            <Button
              className="rounded-2xl"
              key={value}
              onClick={() => updateParam("direction", value)}
              type="button"
              variant={direction === value ? "default" : "outline"}
            >
              {value === "all"
                ? "All"
                : value === "credit"
                  ? "Credits"
                  : "Debits"}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          id="category"
          onChange={(event) => updateParam("category", event.target.value)}
          value={category}
        >
          {categories.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All" : value.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="from">Date from</Label>
        <Input
          id="from"
          onChange={(event) => updateParam("from", event.target.value)}
          type="date"
          value={dateFrom}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="to">Date to</Label>
        <Input
          id="to"
          onChange={(event) => updateParam("to", event.target.value)}
          type="date"
          value={dateTo}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="query">Search</Label>
        <Input
          id="query"
          onChange={(event) => updateParam("query", event.target.value)}
          placeholder="Search description or merchant"
          value={query}
        />
      </div>
    </div>
  );
}
