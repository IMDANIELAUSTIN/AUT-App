import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { useEquation, fmtFiat, fmtRatio, STATUS_META } from "@/lib/equation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

export default function Scenarios({ embedded = false }: { embedded?: boolean } = {}) {
  const { state, computed } = useEquation();
  const status = STATUS_META[computed.status];
  const scenarios = [
    { name: "Current", net: computed.surplus },
    { name: "Pay Raise (+10%)", net: computed.income * 1.1 - computed.expenses },
    {
      name: "More Hours (+10)",
      net: computed.netHourlyWage * (computed.monthlyHours + 10) - computed.expenses,
    },
    {
      name: "Both Raise & Hours",
      net: computed.netHourlyWage * 1.1 * (computed.monthlyHours + 10) - computed.expenses,
    },
  ];
  const bestScenario = scenarios.reduce(
    (best, scenario) => (scenario.net > best.net ? scenario : best),
    scenarios[0],
  );
  const strategyNotes = buildScenarioStrategy(computed);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]",
        !embedded && "p-4 md:p-6",
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Compare Scenarios</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={scenarios} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
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
                  tickFormatter={(v) => fmtFiat(Number(v), state.fiat, { compact: true })}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "none",
                    borderRadius: 8,
                    boxShadow:
                      "inset 0 0 0 1px var(--edge-highlight), 0 0 0 1px var(--edge-shadow)",
                    fontSize: 12,
                  }}
                  formatter={(v) => fmtFiat(Number(v), state.fiat)}
                />
                <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                  {scenarios.map((s, i) => (
                    <Cell key={i} fill={s.net >= 0 ? "var(--success)" : "var(--destructive)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Scenario Strategy</CardTitle>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium sharp-edge",
                status.chip,
              )}
            >
              {status.label}
            </span>
          </CardHeader>
          <CardBody>
            <div className="font-display text-2xl font-semibold tabular text-foreground">
              {fmtFiat(bestScenario.net, state.fiat)}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Best projected net from <span className="text-foreground">{bestScenario.name}</span>.
            </p>
            <ul className="mt-4 space-y-2 text-xs">
              {strategyNotes.map((note) => (
                <li key={note} className="flex gap-2 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Baseline</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <ScenarioStat label="Income / Expense" value={fmtRatio(computed.ratio)} />
              <ScenarioStat
                label="Net Surplus"
                value={fmtFiat(computed.surplus, state.fiat)}
                valueClass={status.color}
              />
              <ScenarioStat
                label="Monthly Hours"
                value={`${computed.monthlyHours.toFixed(0)} hrs`}
              />
              <ScenarioStat label="Break-Even" value={`${computed.breakEvenHrs.toFixed(1)} hrs`} />
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ScenarioStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("font-display text-base font-semibold tabular", valueClass)}>{value}</div>
    </div>
  );
}

function buildScenarioStrategy(computed: ReturnType<typeof useEquation>["computed"]) {
  const notes: string[] = [];
  if (computed.ratio < 1) {
    notes.push("Priority one is reaching break-even before optimizing for savings.");
  } else if (computed.ratio < 1.2) {
    notes.push("The current plan works, but it leaves a thin buffer against surprise expenses.");
  } else {
    notes.push(
      "The baseline is stable enough to compare upside strategies instead of survival fixes.",
    );
  }

  const hoursGap = computed.breakEvenHrs - computed.monthlyHours;
  if (hoursGap > 0) {
    notes.push(`The hours strategy closes a ${hoursGap.toFixed(1)} hour monthly break-even gap.`);
  } else {
    notes.push(
      `You are already ${Math.abs(hoursGap).toFixed(1)} hours above break-even this month.`,
    );
  }

  notes.push(
    "Compare pay raise and hours together to see whether income growth or time expansion carries the bigger return.",
  );
  return notes;
}
