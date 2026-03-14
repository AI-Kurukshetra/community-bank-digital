"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type MonthlyOperationsPoint = {
  cheques: number;
  customers: number;
  fraud: number;
  month: string;
  tickets: number;
};

function formatCount(value: number) {
  return `${value}`;
}

export function AdminOverviewCharts({
  monthlySeries
}: {
  monthlySeries: MonthlyOperationsPoint[];
}) {
  if (monthlySeries.length === 0) {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="flex min-h-[320px] items-center justify-center p-6 text-sm text-slate-500">
            No operational chart data is available yet.
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-h-[320px] items-center justify-center p-6 text-sm text-slate-500">
            No operational chart data is available yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Customer & Support Trend</CardTitle>
          <CardDescription>
            Monthly onboarding compared with ticket creation volume.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-6 pr-6">
          <ResponsiveContainer height={320} width="100%">
            <AreaChart
              data={monthlySeries}
              margin={{ bottom: 0, left: 0, right: 0, top: 8 }}
            >
              <defs>
                <linearGradient id="customersFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#2440a8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2440a8" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ticketsFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#f17ab1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f17ab1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis
                allowDecimals={false}
                stroke="#94a3b8"
                tickFormatter={formatCount}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip />
              <Legend />
              <Area
                dataKey="customers"
                fill="url(#customersFill)"
                name="Customers"
                stroke="#2440a8"
                strokeWidth={2.5}
                type="monotone"
              />
              <Area
                dataKey="tickets"
                fill="url(#ticketsFill)"
                name="Support tickets"
                stroke="#f17ab1"
                strokeWidth={2.5}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Risk & Review Volume</CardTitle>
          <CardDescription>
            Fraud alerts and cheque submissions by month.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-6 pr-6">
          <ResponsiveContainer height={320} width="100%">
            <BarChart
              data={monthlySeries}
              margin={{ bottom: 0, left: 0, right: 0, top: 8 }}
            >
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis
                allowDecimals={false}
                stroke="#94a3b8"
                tickFormatter={formatCount}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="fraud"
                fill="#d63b3b"
                name="Fraud alerts"
                radius={[10, 10, 0, 0]}
              />
              <Bar
                dataKey="cheques"
                fill="#0f8a4c"
                name="Cheque deposits"
                radius={[10, 10, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
