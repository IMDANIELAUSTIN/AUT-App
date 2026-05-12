import { InputsPanel } from "@/components/InputsPanel";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { useEquation, fmtFiat, STATUS_META, type FiatCode } from "@/lib/equation";
import { cn } from "@/lib/utils";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type PieSlice = { name: string; value: number; color: string };

export default function Budget() {
  const { state, computed } = useEquation();
  const status = STATUS_META[computed.status];
  const basicsTotal =
    state.expenseItems.rent +
    state.expenseItems.groceries +
    state.expenseItems.utilities +
    state.expenseItems.transportation;
  const extracurricularTotal =
    state.expenseItems.healthInsurance +
    state.expenseItems.savings +
    state.expenseItems.recreational +
    computed.subscriptionExpenses;
  const contingencyTotal = state.expenseItems.contingency;
  const basics: PieSlice[] = [
    { name: "Rent", value: state.expenseItems.rent, color: "var(--chart-1)" },
    { name: "Groceries", value: state.expenseItems.groceries, color: "var(--chart-2)" },
    { name: "Utilities", value: state.expenseItems.utilities, color: "var(--chart-3)" },
    { name: "Transportation", value: state.expenseItems.transportation, color: "var(--chart-4)" },
  ];
  const extracurricular: PieSlice[] = [
    {
      name: "Health Insurance",
      value: state.expenseItems.healthInsurance,
      color: "var(--chart-1)",
    },
    { name: "Savings", value: state.expenseItems.savings, color: "var(--chart-3)" },
    { name: "Recreational", value: state.expenseItems.recreational, color: "var(--chart-4)" },
    { name: "Subscriptions", value: computed.subscriptionExpenses, color: "var(--chart-5)" },
  ];
  const contingency: PieSlice[] = [
    { name: "Contingency", value: contingencyTotal, color: "var(--warning)" },
    {
      name: "Basics + extracurricular",
      value: basicsTotal + extracurricularTotal,
      color: "var(--muted)",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 p-4 md:p-6">
      <InputsPanel />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Budget</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="font-display text-3xl md:text-5xl font-semibold tracking-tight">
              M <span className="text-muted-foreground">=</span> E{" "}
              <span className="text-muted-foreground">×</span> T{" "}
              <span className="text-muted-foreground">×</span> C
            </div>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  sym: "M",
                  label: "Money",
                  sub: "Monthly expenses required",
                  v: fmtFiat(computed.expenses, state.fiat),
                },
                { sym: "E", label: "Effort", sub: "Effort multiplier", v: `${state.effort}×` },
                {
                  sym: "T",
                  label: "Time",
                  sub: `Hours / ${state.timeUnit}`,
                  v: `${state.hoursPerUnit}`,
                },
                {
                  sym: "C",
                  label: "Income",
                  sub: "Hourly wage / value of labor",
                  v: fmtFiat(computed.hourlyWage, state.fiat),
                },
              ].map((x) => (
                <div key={x.sym} className="rounded-lg bg-surface-2/40 p-3 sharp-edge">
                  <div className="font-display text-2xl font-semibold">{x.sym}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {x.label}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{x.sub}</div>
                  <div className="mt-2 font-display text-base tabular">{x.v}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <div className="grid gap-4 xl:grid-cols-3">
          <BudgetPieCard title="The Basics" total={basicsTotal} fiat={state.fiat} data={basics} />
          <BudgetPieCard
            title="Extracurricular"
            total={extracurricularTotal}
            fiat={state.fiat}
            data={extracurricular}
          />
          <BudgetPieCard
            title="Contingency"
            total={contingencyTotal}
            fiat={state.fiat}
            data={contingency}
            note={`${percentage(contingencyTotal, basicsTotal + extracurricularTotal + contingencyTotal)} of planned expenses`}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Monthly Income Potential
                </div>
                <div className="font-display text-3xl font-semibold tabular text-[color:var(--success)]">
                  {fmtFiat(computed.income, state.fiat)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {computed.surplus >= 0 ? "Surplus" : "Deficit"}
                </div>
                <div className={cn("font-display text-3xl font-semibold tabular", status.color)}>
                  {fmtFiat(computed.surplus, state.fiat)}
                </div>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] sharp-edge",
                    status.chip,
                  )}
                >
                  {status.label}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function BudgetPieCard({
  title,
  total,
  fiat,
  data,
  note,
}: {
  title: string;
  total: number;
  fiat: FiatCode;
  data: PieSlice[];
  note?: string;
}) {
  const safeTotal = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="relative h-44">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <PieChart>
              <Pie
                data={data.filter((item) => item.value > 0)}
                dataKey="value"
                innerRadius={42}
                outerRadius={70}
                stroke="none"
                paddingAngle={2}
              >
                {data
                  .filter((item) => item.value > 0)
                  .map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "none",
                  borderRadius: 8,
                  boxShadow: "inset 0 0 0 1px var(--edge-highlight), 0 0 0 1px var(--edge-shadow)",
                  fontSize: 12,
                }}
                formatter={(value, name) => [fmtFiat(Number(value) || 0, fiat), String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-display text-xl font-semibold tabular">
                {fmtFiat(total, fiat, { compact: true })}
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {note || "Monthly"}
              </div>
            </div>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-[11px]">
          {data.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: item.color }}
                />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 tabular text-muted-foreground">
                {percentage(item.value, safeTotal)}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function percentage(value: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}
