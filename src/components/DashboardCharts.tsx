import {
  Bar,
  Cell,
  ComposedChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtFiat, type FiatCode } from "@/lib/equation";
import type { ReactNode } from "react";

type SparkPoint = { x: string; y: number };
type LivePoint = { month: string; income: number; expenses: number; net: number };
type TimeAllocationPoint = { name: string; value: number; color: string };

export function SparkChart({ data, positive }: { data: SparkPoint[]; positive?: boolean }) {
  const color = positive ? "var(--success)" : "var(--destructive)";
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function IncomeExpensesChart({
  data,
  fiat,
  breakEven,
}: {
  data: LivePoint[];
  fiat: FiatCode;
  breakEven: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
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
          formatter={(v, name) => [fmtFiat(Number(v) || 0, fiat), String(name)] as ReactNode[]}
        />
        <ReferenceLine
          y={breakEven}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{
            value: "Break-even",
            fill: "var(--muted-foreground)",
            fontSize: 10,
            position: "insideTopRight",
          }}
        />
        <Bar dataKey="net" radius={[3, 3, 0, 0]} maxBarSize={28}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.net >= 0 ? "var(--success)" : "var(--destructive)"} />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="income"
          stroke="var(--success)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          stroke="var(--destructive)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function TimeAllocationChart({ data }: { data: TimeAllocationPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={48}
          outerRadius={68}
          stroke="none"
          paddingAngle={2}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
