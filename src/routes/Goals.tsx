import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Plus, Target } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { Button } from "@/components/openui/Button";
import { Input } from "@/components/openui/Input";
import { useEquation, fmtFiat, FIAT_SYMBOL } from "@/lib/equation";
import { cn } from "@/lib/utils";
import Insights from "@/routes/Insights";
import Scenarios from "@/routes/Scenarios";
import { toast } from "sonner";
import {
  loadGoalSnapshots,
  loadGoalTargets,
  num,
  saveGoalSnapshots,
  saveGoalTargets,
  type GoalSnapshot as Snapshot,
  type GoalTargets as Targets,
} from "@/lib/goalsStorage";

function uid() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

export default function Goals() {
  const { state, computed, activeProfileId } = useEquation();
  const sym = FIAT_SYMBOL[state.fiat];

  const defaults: Targets = useMemo(
    () => ({
      expenses: Math.round(computed.expenses),
      savings: Math.round(state.expenseItems.savings || 500),
      wage: Math.round(computed.income),
      hours: Math.round(computed.monthlyHours),
      surplus: Math.max(500, Math.round(computed.income - computed.expenses)),
    }),
    [computed.expenses, computed.income, computed.monthlyHours, state.expenseItems.savings],
  );

  const defaultsRef = useRef(defaults);
  const [storageProfileId, setStorageProfileId] = useState(activeProfileId);
  const [targets, setTargets] = useState<Targets>(() => loadGoalTargets(defaults, activeProfileId));
  const [snaps, setSnaps] = useState<Snapshot[]>(() => loadGoalSnapshots(activeProfileId));

  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  useEffect(() => {
    setTargets(loadGoalTargets(defaultsRef.current, activeProfileId));
    setSnaps(loadGoalSnapshots(activeProfileId));
    setStorageProfileId(activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    if (storageProfileId !== activeProfileId) return;
    saveGoalTargets(targets, activeProfileId);
  }, [activeProfileId, storageProfileId, targets]);

  useEffect(() => {
    if (storageProfileId !== activeProfileId) return;
    saveGoalSnapshots(snaps, activeProfileId);
  }, [activeProfileId, storageProfileId, snaps]);

  const update = (k: keyof Targets, v: number) => setTargets((t) => ({ ...t, [k]: num(v) }));

  const resetTargetsToCurrent = () => {
    setTargets(defaults);
    toast.success("Goals reset", {
      description: "Monthly targets now match your current dashboard values.",
    });
  };

  const logSnapshot = () => {
    const snapshot: Snapshot = {
      id: uid(),
      date: new Date().toISOString(),
      income: computed.income,
      expenses: computed.expenses,
      surplus: computed.income - computed.expenses,
      hours: computed.monthlyHours,
    };
    const currentMonth = monthKey(snapshot.date);
    const exists = snaps.some((snap) => monthKey(snap.date) === currentMonth);
    setSnaps((current) =>
      exists
        ? current.map((snap) =>
            monthKey(snap.date) === currentMonth ? { ...snapshot, id: snap.id } : snap,
          )
        : [...current, snapshot],
    );
    toast.success(exists ? "This month updated" : "This month logged", {
      description: `${fmtFiat(snapshot.surplus, state.fiat)} surplus saved to Snapshot Log.`,
    });
  };

  const removeSnap = (id: string) => setSnaps((s) => s.filter((x) => x.id !== id));

  const cumulative = useMemo(() => {
    let total = 0;
    return snaps
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        total += s.surplus;
        return {
          label: new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          surplus: s.surplus,
          cumulative: total,
        };
      });
  }, [snaps]);

  const cumulativeSurplus = cumulative.length ? cumulative[cumulative.length - 1].cumulative : 0;
  const annualTarget = targets.surplus * 12;
  const towardAnnual =
    annualTarget > 0 ? Math.min(100, (cumulativeSurplus / annualTarget) * 100) : 0;

  // current-period progress (vs targets)
  const items: Array<{
    key: keyof Targets;
    label: string;
    current: number;
    target: number;
    format: (n: number) => string;
    higherIsBetter: boolean;
  }> = [
    {
      key: "wage",
      label: "Net income / month",
      current: computed.income,
      target: targets.wage,
      format: (n) => fmtFiat(n, state.fiat),
      higherIsBetter: true,
    },
    {
      key: "expenses",
      label: "Expenses / month",
      current: computed.expenses,
      target: targets.expenses,
      format: (n) => fmtFiat(n, state.fiat),
      higherIsBetter: false,
    },
    {
      key: "savings",
      label: "Savings allocation",
      current: state.expenseItems.savings,
      target: targets.savings,
      format: (n) => fmtFiat(n, state.fiat),
      higherIsBetter: true,
    },
    {
      key: "hours",
      label: "Work hours / month",
      current: computed.monthlyHours,
      target: targets.hours,
      format: (n) => `${n.toFixed(0)} h`,
      higherIsBetter: false,
    },
    {
      key: "surplus",
      label: "Surplus / month",
      current: computed.income - computed.expenses,
      target: targets.surplus,
      format: (n) => fmtFiat(n, state.fiat),
      higherIsBetter: true,
    },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Goals
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Set targets, review insights, compare scenarios, and track surplus over time.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetTargetsToCurrent}>
            Reset To Current
          </Button>
          <Button size="sm" onClick={logSnapshot}>
            <Plus className="h-3.5 w-3.5" /> Log This Month
          </Button>
        </div>
      </div>

      <Scenarios embedded />

      <Insights embedded />

      {/* Targets editor + progress */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Targets</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <TargetField
              label={`Net income (${sym}/mo)`}
              value={targets.wage}
              onChange={(v) => update("wage", v)}
            />
            <TargetField
              label={`Expenses (${sym}/mo)`}
              value={targets.expenses}
              onChange={(v) => update("expenses", v)}
            />
            <TargetField
              label={`Savings (${sym}/mo)`}
              value={targets.savings}
              onChange={(v) => update("savings", v)}
            />
            <TargetField
              label="Work hours / mo"
              value={targets.hours}
              step={5}
              onChange={(v) => update("hours", v)}
            />
            <TargetField
              label={`Surplus (${sym}/mo)`}
              value={targets.surplus}
              onChange={(v) => update("surplus", v)}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Current vs Target</CardTitle>
            <span className="text-[11px] tabular text-muted-foreground">Live from inputs</span>
          </CardHeader>
          <CardBody className="space-y-3">
            {items.map((it) => {
              const pct = it.target > 0 ? (it.current / it.target) * 100 : 0;
              const ok = it.higherIsBetter ? pct >= 100 : pct <= 100;
              const fillPct = Math.min(100, Math.max(0, pct));
              return (
                <div key={it.key}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{it.label}</span>
                    <span className="tabular text-foreground">
                      <span
                        className={cn(
                          ok ? "text-[color:var(--success)]" : "text-[color:var(--warning)]",
                        )}
                      >
                        {it.format(it.current)}
                      </span>
                      <span className="text-muted-foreground"> / {it.format(it.target)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-1.5 rounded-full",
                        ok ? "bg-[color:var(--success)]" : "bg-[color:var(--warning)]",
                      )}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      {/* Surplus over time */}
      <Card>
        <CardHeader>
          <CardTitle>Surplus Over Time</CardTitle>
          <span className="flex items-center gap-2 text-[11px] tabular text-muted-foreground">
            <Target className="h-3 w-3" />
            Annual target: {fmtFiat(annualTarget, state.fiat)} · Logged:{" "}
            {fmtFiat(cumulativeSurplus, state.fiat)} ({towardAnnual.toFixed(0)}%)
          </span>
        </CardHeader>
        <CardBody>
          {cumulative.length === 0 ? (
            <div className="grid h-48 place-items-center text-center text-xs text-muted-foreground">
              No snapshots yet. Click{" "}
              <span className="mx-1 font-semibold text-foreground">Log This Month</span> to track
              progress.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <LineChart data={cumulative} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    stroke="oklch(0.28 0.01 250)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="label" stroke="oklch(0.65 0.01 250)" fontSize={11} />
                  <YAxis
                    stroke="oklch(0.65 0.01 250)"
                    fontSize={11}
                    tickFormatter={(v) => fmtFiat(Number(v), state.fiat, { compact: true })}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.18 0.01 250)",
                      border: "1px solid oklch(0.3 0.01 250)",
                      fontSize: 12,
                    }}
                    formatter={(v, name) => [
                      fmtFiat(Number(v) || 0, state.fiat),
                      name === "cumulative" ? "Cumulative" : "Surplus",
                    ]}
                  />
                  <ReferenceLine
                    y={annualTarget}
                    stroke="oklch(0.7 0.15 145)"
                    strokeDasharray="4 4"
                    label={{
                      value: "Annual target",
                      fill: "oklch(0.7 0.15 145)",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="oklch(0.75 0.15 220)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="surplus"
                    stroke="oklch(0.7 0.13 60)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Snapshots log */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshot Log</CardTitle>
          <span className="text-[11px] tabular text-muted-foreground">{snaps.length} entries</span>
        </CardHeader>
        <CardBody>
          {snaps.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No entries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Date</th>
                  <th className="text-right">Income</th>
                  <th className="text-right">Expenses</th>
                  <th className="text-right">Surplus</th>
                  <th className="text-right">Hours</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {snaps
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((s) => (
                    <tr key={s.id} className="sharp-divider-t">
                      <td className="py-2">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="text-right tabular">{fmtFiat(s.income, state.fiat)}</td>
                      <td className="text-right tabular">{fmtFiat(s.expenses, state.fiat)}</td>
                      <td
                        className={cn(
                          "text-right tabular",
                          s.surplus >= 0
                            ? "text-[color:var(--success)]"
                            : "text-[color:var(--destructive)]",
                        )}
                      >
                        {fmtFiat(s.surplus, state.fiat)}
                      </td>
                      <td className="text-right tabular">{s.hours.toFixed(0)} h</td>
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove"
                          onClick={() => removeSnap(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function TargetField({
  label,
  value,
  step = 50,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        min="0"
        step={step}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(num(draft ?? value));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-8 w-32 text-right text-xs"
      />
    </label>
  );
}
