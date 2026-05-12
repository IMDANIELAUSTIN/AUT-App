import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { useEquation, fmtFiat, type FiatCode } from "@/lib/equation";
import { useNetWorthContext } from "@/lib/netWorthContext";
import type { NetWorthEntry } from "@/lib/useNetWorth";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

type Granularity = "weekly" | "monthly";

export function NetWorthOverTime() {
  const { state } = useEquation();
  const { entries, netWorth, count } = useNetWorthContext();
  const [granularity, setGranularity] = useState<Granularity>("monthly");

  const data = useMemo(() => buildSeries(entries, granularity), [entries, granularity]);

  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-0.5">
          <CardTitle>Net Worth Over Time</CardTitle>
          <span className="font-display text-lg font-semibold tabular leading-none">
            {fmtFiat(netWorth, state.fiat)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] sm:ml-auto">
          {(["weekly", "monthly"] as Granularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={cn(
                "min-h-7 rounded-md px-2.5 py-1 capitalize text-muted-foreground hover:bg-muted hover:text-foreground",
                g === granularity && "bg-muted text-foreground",
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardBody>
        {count === 0 ? (
          <div className="grid h-48 place-items-center rounded-lg bg-surface-2/30 p-6 text-center sharp-edge">
            <p className="text-sm font-medium">No data yet</p>
            <p className="text-xs text-muted-foreground">
              Import expenses or connect a bank to see your net worth trend.
            </p>
          </div>
        ) : (
          <NetWorthChart data={data} fiat={state.fiat} />
        )}
      </CardBody>
    </Card>
  );
}

function NetWorthChart({
  data,
  fiat,
}: {
  data: Array<{ label: string; netWorth: number }>;
  fiat: FiatCode;
}) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => fmtFiat(v as number, fiat, { compact: true })}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "none",
              borderRadius: 8,
              boxShadow: "inset 0 0 0 1px var(--edge-highlight), 0 0 0 1px var(--edge-shadow)",
              fontSize: 12,
            }}
            formatter={(v) => [fmtFiat(Number(v) || 0, fiat), "Net worth"]}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="var(--success)"
            strokeWidth={2}
            fill="url(#nw-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildSeries(entries: NetWorthEntry[], granularity: Granularity) {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const buckets = new Map<string, number>();
  for (const entry of sorted) {
    const key = bucketKey(entry.date, granularity);
    buckets.set(key, (buckets.get(key) || 0) + entry.amount);
  }
  const keys = Array.from(buckets.keys()).sort();
  let running = 0;
  return keys.map((key) => {
    running += buckets.get(key) || 0;
    // running is sum of (positive=expense, negative=income); net worth = -running
    return { label: formatLabel(key, granularity), netWorth: -running };
  });
}

function bucketKey(date: string, granularity: Granularity) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  if (granularity === "monthly") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  // weekly: ISO-ish week start (Monday)
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10);
}

function formatLabel(key: string, granularity: Granularity) {
  if (granularity === "monthly") {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  const d = new Date(key);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
