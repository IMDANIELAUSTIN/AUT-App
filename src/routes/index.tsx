import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  CartesianGrid,
  Area,
  ComposedChart,
} from "recharts";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "The Austin Equation — M = E × T × C" },
      {
        name: "description",
        content:
          "A quiet calculator for understanding whether your labor structure can support your cost of living.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
});

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Field({
  label,
  suffix,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-2 border-b border-border py-2 focus-within:border-foreground transition-colors">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="tabular w-full bg-transparent text-2xl font-display outline-none"
        />
        {suffix && (
          <span className="text-xs text-muted-foreground tracking-wide">{suffix}</span>
        )}
      </div>
    </label>
  );
}

function Index() {
  const [expenses, setExpenses] = useState(3200);
  const [wage, setWage] = useState(28);
  const [hours, setHours] = useState(160);
  const [effort, setEffort] = useState(1);

  const { income, surplus, breakEven, status } = useMemo(() => {
    const income = effort * hours * wage;
    const surplus = income - expenses;
    const breakEven = wage > 0 ? expenses / (wage * effort) : 0;
    const ratio = expenses > 0 ? income / expenses : 0;
    const status: "sustainable" | "thin" | "deficit" =
      ratio >= 1.2 ? "sustainable" : ratio >= 1 ? "thin" : "deficit";
    return { income, surplus, breakEven, status };
  }, [expenses, wage, hours, effort]);

  const chartData = useMemo(() => {
    const maxH = Math.max(hours * 1.5, breakEven * 1.4, 40);
    const points = 14;
    return Array.from({ length: points + 1 }, (_, i) => {
      const h = (maxH / points) * i;
      return {
        hours: Math.round(h),
        income: Math.round(h * wage * effort),
        expenses,
      };
    });
  }, [hours, wage, effort, expenses, breakEven]);

  const statusCopy = {
    sustainable: "Sustainable. Your labor structure covers your obligations with margin.",
    thin: "Thin margin. Income meets expenses but leaves little room.",
    deficit: "Deficit. Current hours and wage do not cover monthly obligations.",
  }[status];

  const statusColor = {
    sustainable: "oklch(0.62 0.13 155)",
    thin: "oklch(0.72 0.13 80)",
    deficit: "oklch(0.55 0.18 25)",
  }[status];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-16">
        {/* Masthead */}
        <header className="flex items-baseline justify-between border-b border-border pb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              An instrument for labor
            </p>
            <h1 className="font-display text-2xl md:text-3xl mt-1">The Austin Equation</h1>
          </div>
          <p className="hidden md:block font-display italic text-muted-foreground tabular">
            M = E · T · C
          </p>
        </header>

        {/* Hero */}
        <section className="grid gap-10 lg:grid-cols-[1.1fr_1.4fr] py-10 md:py-14 border-b border-border">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Monthly {surplus >= 0 ? "surplus" : "deficit"}
              </p>
              <p
                className="font-display tabular text-6xl md:text-8xl leading-none mt-3"
                style={{ color: statusColor }}
              >
                {surplus >= 0 ? "+" : "−"}
                {fmt(Math.abs(surplus))}
              </p>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
                {statusCopy}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <span>{status}</span>
            </div>
          </div>

          <div className="h-[300px] md:h-[360px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={statusColor} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={statusColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="hours"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)" }}
                  label={{
                    value: "hours / month",
                    position: "insideBottom",
                    offset: -4,
                    fill: "var(--color-muted-foreground)",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmt(v)}
                  labelFormatter={(l) => `${l} hours`}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="none"
                  fill="url(#incomeFill)"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="3 4"
                  strokeWidth={1.25}
                  dot={false}
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke={statusColor}
                  strokeWidth={2}
                  dot={false}
                  name="Income"
                />
                <ReferenceLine
                  x={Math.round(breakEven)}
                  stroke="var(--color-foreground)"
                  strokeWidth={0.75}
                  label={{
                    value: "break-even",
                    position: "top",
                    fill: "var(--color-foreground)",
                    fontSize: 10,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Inputs + Metrics */}
        <section className="grid gap-12 lg:grid-cols-[1fr_1fr] py-10 md:py-14">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
              I. Inputs
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <Field
                label="Monthly expenses (M)"
                suffix="USD"
                value={expenses}
                onChange={setExpenses}
                step={50}
              />
              <Field
                label="Hourly wage (C)"
                suffix="USD / hr"
                value={wage}
                onChange={setWage}
                step={0.5}
              />
              <Field
                label="Work hours / month (T)"
                suffix="hrs"
                value={hours}
                onChange={setHours}
                step={1}
              />
              <Field
                label="Effort multiplier (E)"
                value={effort}
                onChange={setEffort}
                step={0.1}
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
              II. Reading
            </p>
            <dl className="divide-y divide-border border-y border-border">
              <Row label="Gross earning potential" value={fmt(income)} />
              <Row
                label="Monthly surplus / deficit"
                value={`${surplus >= 0 ? "+" : "−"}${fmt(Math.abs(surplus))}`}
              />
              <Row
                label="Break-even hours required"
                value={`${breakEven.toFixed(1)} hrs`}
              />
              <Row
                label="Income / expense ratio"
                value={(expenses > 0 ? income / expenses : 0).toFixed(2) + "×"}
              />
            </dl>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="font-display italic">
            "Money is the measure of effort exchanged for time."
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 border border-border px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors"
          >
            <span className="tracking-[0.14em] uppercase text-[10px]">Support development</span>
          </a>
        </footer>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-display tabular text-2xl">{value}</dd>
    </div>
  );
}
