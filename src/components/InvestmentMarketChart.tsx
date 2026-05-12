import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type InvestmentMarketChartProps = {
  data: Array<{ time: string; value: number }>;
};

export function InvestmentMarketChart({ data }: InvestmentMarketChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320} minWidth={1} minHeight={1}>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="investmentMarketFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.34} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={11} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickFormatter={(value) =>
            `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
          }
          domain={["dataMin", "dataMax"]}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-2)",
            border: "none",
            borderRadius: 8,
            boxShadow: "inset 0 0 0 1px var(--edge-highlight), 0 0 0 1px var(--edge-shadow)",
            fontSize: 12,
          }}
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Price"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2.5}
          fill="url(#investmentMarketFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
