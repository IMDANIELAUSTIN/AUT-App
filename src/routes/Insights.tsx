import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { useEquation, fmtFiat } from "@/lib/equation";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

export default function Insights({ embedded = false }: { embedded?: boolean } = {}) {
  const { state, computed, subscriptionSummary } = useEquation();
  const data = (Object.entries(state.expenseItems) as Array<[string, number]>).map(([k, v], i) => ({
    name: k,
    value: v,
    color: `var(--chart-${(i % 6) + 1})`,
  }));
  if (subscriptionSummary.monthlyTotal > 0) {
    data.push({
      name: "subscriptions",
      value: subscriptionSummary.monthlyTotal,
      color: "var(--chart-6)",
    });
  }
  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2", !embedded && "p-4 md:p-6")}>
      <Card>
        <CardHeader>
          <CardTitle>Spending Breakdown</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] items-center gap-4">
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="font-display text-lg font-semibold tabular">
                    {fmtFiat(computed.expenses, state.fiat, { compact: true })}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Total
                  </div>
                </div>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs">
              {data.map((d) => {
                const pct = (d.value / Math.max(computed.expenses, 1)) * 100;
                return (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 capitalize">
                      <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                      {d.name.replace(/([A-Z])/g, " $1").toLowerCase()}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {pct.toFixed(1)}% — {fmtFiat(d.value, state.fiat)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Trend Over Time</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Net Take-Home Income
          </div>
          <div className="font-display text-3xl font-semibold tabular">
            {fmtFiat(computed.income, state.fiat)}
          </div>
          <p className="mt-1 text-xs text-[color:var(--success)]">+18.0% vs last 6 months</p>
          <ul className="mt-4 space-y-1 text-xs">
            {computed.series.slice(-5).map((s) => (
              <li key={s.month} className="flex items-center justify-between sharp-divider-b py-1">
                <span className="text-muted-foreground">{s.month}</span>
                <span className="tabular">{fmtFiat(s.income, state.fiat)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
