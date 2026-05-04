import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import jsPDF from "jspdf";
import { Settings as SettingsIcon, Share2, Printer, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

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
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
});

// ---------- Currency / conversion ----------
type FiatCode = "NONE" | "USD" | "EUR" | "GBP" | "JPY" | "CAD";
type CryptoCode = "NONE" | "BTC" | "ETH" | "SOL" | "USDC";

const FIAT_PER_USD: Record<Exclude<FiatCode, "NONE">, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 156.4,
  CAD: 1.37,
};
const USD_PER_CRYPTO: Record<Exclude<CryptoCode, "NONE">, number> = {
  BTC: 67000,
  ETH: 3400,
  SOL: 165,
  USDC: 1,
};
const FIAT_SYMBOL: Record<FiatCode, string> = {
  NONE: "",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
};

const fmtFiat = (n: number, code: FiatCode) => {
  if (code === "NONE") {
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  });
};

// ---------- Pay frequency ----------
type PayFreq = "hourly" | "daily" | "weekly" | "biweekly" | "monthly";
type TimeUnit = "day" | "week" | "month";

const HOURS_PER_UNIT: Record<TimeUnit, number> = { day: 8, week: 40, month: 160 };
const UNIT_TO_MONTH: Record<TimeUnit, number> = {
  day: (30 / 7) * 5,
  week: 4.33,
  month: 1,
};

function toHourly(amount: number, freq: PayFreq, hoursPerWeek: number): number {
  if (amount <= 0) return 0;
  switch (freq) {
    case "hourly": return amount;
    case "daily": return amount / (hoursPerWeek / 5);
    case "weekly": return amount / hoursPerWeek;
    case "biweekly": return amount / (hoursPerWeek * 2);
    case "monthly": return amount / (hoursPerWeek * 4.33);
  }
}

// ---------- Tax ----------
type TaxConfig = {
  federal: number; // %
  state: number;
  fica: number;
  other: number;
};
const DEFAULT_TAX: TaxConfig = { federal: 12, state: 5, fica: 7.65, other: 0 };

// ---------- Persistence ----------
const STORAGE_KEY = "austin-equation:v2";

function loadState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

// ---------- Component ----------
function Index() {
  const initial = loadState(STORAGE_KEY, {
    fiat: "USD" as FiatCode,
    crypto: "BTC" as CryptoCode,
    expenses: 3200,
    wageAmount: 1120,
    payFreq: "weekly" as PayFreq,
    timeUnit: "week" as TimeUnit,
    hoursPerUnit: 40,
    effort: 1,
    taxEnabled: false,
    tax: DEFAULT_TAX,
    slide: 0,
    surplusAsHours: false,
  });

  const [fiat, setFiat] = useState<FiatCode>(initial.fiat);
  const [crypto, setCrypto] = useState<CryptoCode>(initial.crypto);
  const [expenses, setExpenses] = useState<number>(initial.expenses);
  const [wageAmount, setWageAmount] = useState<number>(initial.wageAmount);
  const [payFreq, setPayFreq] = useState<PayFreq>(initial.payFreq);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>(initial.timeUnit);
  const [hoursPerUnit, setHoursPerUnit] = useState<number>(initial.hoursPerUnit);
  const [effort, setEffort] = useState<number>(initial.effort);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(initial.taxEnabled);
  const [tax, setTax] = useState<TaxConfig>(initial.tax);
  const [initialSlide] = useState<number>(initial.slide);
  const [currentSlide, setCurrentSlide] = useState<number>(initial.slide);
  const [surplusAsHours, setSurplusAsHours] = useState<boolean>(initial.surplusAsHours);

  // Reset hours when time unit changes (only after first render)
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setHoursPerUnit(HOURS_PER_UNIT[timeUnit]);
  }, [timeUnit]);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          fiat, crypto, expenses, wageAmount, payFreq, timeUnit,
          hoursPerUnit, effort, taxEnabled, tax, slide: currentSlide,
          surplusAsHours,
        }),
      );
    } catch {}
  }, [fiat, crypto, expenses, wageAmount, payFreq, timeUnit, hoursPerUnit, effort, taxEnabled, tax, currentSlide, surplusAsHours]);

  const taxRate = taxEnabled ? Math.max(0, Math.min(100, tax.federal + tax.state + tax.fica + tax.other)) / 100 : 0;

  const { gross, income, surplus, breakEvenHrs, ratio, status, hourlyWage, netHourlyWage, monthlyHours } = useMemo(() => {
    const hoursPerWeekEquiv =
      timeUnit === "day" ? hoursPerUnit * 5 :
      timeUnit === "week" ? hoursPerUnit :
      hoursPerUnit / 4.33;

    const hourlyWage = toHourly(wageAmount, payFreq, hoursPerWeekEquiv);
    const monthlyHours = hoursPerUnit * UNIT_TO_MONTH[timeUnit];
    const gross = effort * monthlyHours * hourlyWage;
    const income = gross * (1 - taxRate);
    const netHourlyWage = hourlyWage * (1 - taxRate);
    const surplus = income - expenses;
    const breakEvenHrs = netHourlyWage > 0 ? expenses / (netHourlyWage * effort) : 0;
    const ratio = expenses > 0 ? income / expenses : 0;
    const status: Status = ratio >= 1.2 ? "sustainable" : ratio >= 1 ? "thin" : "deficit";
    return { gross, income, surplus, breakEvenHrs, ratio, status, hourlyWage, netHourlyWage, monthlyHours };
  }, [expenses, wageAmount, payFreq, hoursPerUnit, timeUnit, effort, taxRate]);

  // Crypto equivalents
  const usdRate = fiat === "NONE" ? 1 : FIAT_PER_USD[fiat];
  const incomeUSD = income / usdRate;
  const cryptoEquivalent = crypto === "NONE" ? 0 : incomeUSD / USD_PER_CRYPTO[crypto];

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
        <section className="py-10 md:py-14 border-b border-border">
          <div className="flex items-baseline justify-between mb-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Visualization
            </p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              swipe · arrow keys
            </p>
          </div>
          <VisualizationGallery
            status={status}
            ratio={ratio}
            surplus={surplus}
            income={income}
            expenses={expenses}
            fiat={fiat}
            initialIndex={initialSlide}
            onChange={setCurrentSlide}
          />
        </section>

        {/* Inputs */}
        <section className="grid gap-12 lg:grid-cols-[1fr_1fr] py-10 md:py-14">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
              I. Inputs
            </p>

            <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-8">
              <SelectField
                label="Fiat denomination"
                value={fiat}
                onChange={(v) => setFiat(v as FiatCode)}
                options={["NONE", ...Object.keys(FIAT_PER_USD)]}
              />
              <SelectField
                label="Crypto denomination"
                value={crypto}
                onChange={(v) => setCrypto(v as CryptoCode)}
                options={["NONE", ...Object.keys(USD_PER_CRYPTO)]}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <NumberField
                label={`Monthly expenses (M)`}
                suffix={fiat === "NONE" ? "" : fiat}
                value={expenses}
                onChange={setExpenses}
                step={50}
              />
              <NumberField
                label={`Wage / pay (C)`}
                suffix={`${FIAT_SYMBOL[fiat] || ""} / ${payFreq}`.trim()}
                value={wageAmount}
                onChange={setWageAmount}
                step={1}
              />
              <SelectField
                label="Pay frequency"
                value={payFreq}
                onChange={(v) => setPayFreq(v as PayFreq)}
                options={["hourly", "daily", "weekly", "biweekly", "monthly"]}
              />
              <SelectField
                label="Time scale"
                value={timeUnit}
                onChange={(v) => setTimeUnit(v as TimeUnit)}
                options={["day", "week", "month"]}
              />
              <NumberField
                label={`Work hours / ${timeUnit} (T)`}
                suffix="hrs"
                value={hoursPerUnit}
                onChange={setHoursPerUnit}
                step={1}
              />
              <NumberField
                label="Effort multiplier (E)"
                value={effort}
                onChange={setEffort}
                step={0.1}
              />
            </div>

            {/* Tax toggle */}
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxEnabled}
                  onChange={(e) => setTaxEnabled(e.target.checked)}
                  className="h-4 w-4 accent-foreground cursor-pointer"
                />
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Apply estimated taxes {taxEnabled && `(${(taxRate * 100).toFixed(1)}%)`}
                </span>
              </label>
              <TaxSettingsDialog tax={tax} onChange={setTax} />
            </div>
          </div>

          {/* Reading */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
              II. Reading
            </p>
            <dl className="divide-y divide-border border-y border-border">
              <Row label="Effective hourly wage" value={fmtFiat(hourlyWage, fiat)} />
              {taxEnabled && <Row label="After-tax hourly wage" value={fmtFiat(netHourlyWage, fiat)} />}
              <Row label="Monthly hours worked" value={`${monthlyHours.toFixed(0)} hrs`} />
              <Row label={taxEnabled ? "Gross monthly income" : "Gross monthly income"} value={fmtFiat(gross, fiat)} />
              {taxEnabled && <Row label="Net (take-home) income" value={fmtFiat(income, fiat)} />}
              <SurplusRow
                surplus={surplus}
                fiat={fiat}
                hourlyWage={netHourlyWage}
                asHours={surplusAsHours}
                onToggle={() => setSurplusAsHours((v) => !v)}
              />
              <Row label="Break-even hours / mo." value={`${breakEvenHrs.toFixed(1)} hrs`} />
              <Row label="Income / expense ratio" value={`${ratio.toFixed(2)}×`} />
              {crypto !== "NONE" && (
                <Row
                  label={`Income in ${crypto}`}
                  value={`${cryptoEquivalent.toFixed(crypto === "USDC" ? 0 : 6)} ${crypto}`}
                />
              )}
            </dl>
          </div>
        </section>

        {/* Comparison chart */}
        <section className="border-b border-border py-10 md:py-14">
          <div className="flex items-baseline justify-between mb-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              III. Income vs Expenses
            </p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground tabular">
              monthly · {fiat === "NONE" ? "—" : fiat}
            </p>
          </div>
          <IncomeExpenseChart income={income} expenses={expenses} fiat={fiat} status={status} />
        </section>

        {/* Footer */}
        <footer className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="font-display italic">
            "Money is the measure of effort exchanged for time."
          </p>
          <div className="flex items-center gap-2">
            <PdfPreviewButton
              data={{
                fiat, crypto, expenses, wageAmount, payFreq, timeUnit,
                hoursPerUnit, effort, hourlyWage, monthlyHours,
                income, gross, surplus, breakEvenHrs, ratio, status, cryptoEquivalent,
                taxEnabled, taxRate,
              }}
            />
            <SupportButton />
          </div>
        </footer>
      </div>
    </main>
  );
}

// ---------- Helpers ----------
type Status = "sustainable" | "thin" | "deficit";

const STATUS_COLOR: Record<Status, string> = {
  sustainable: "oklch(0.62 0.13 155)",
  thin: "oklch(0.72 0.13 80)",
  deficit: "oklch(0.55 0.18 25)",
};

function NumberField({ label, suffix, value, onChange, step = 1 }: {
  label: string; suffix?: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-2 border-b border-border py-2 focus-within:border-foreground transition-colors">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="tabular w-full bg-transparent text-2xl font-display outline-none"
        />
        {suffix && <span className="text-xs text-muted-foreground tracking-wide whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <div className="border-b border-border py-2 focus-within:border-foreground transition-colors">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="tabular w-full bg-transparent text-2xl font-display outline-none capitalize cursor-pointer"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-display tabular text-xl md:text-2xl">{value}</dd>
    </div>
  );
}

function SurplusRow({ surplus, fiat, hourlyWage, asHours, onToggle }: {
  surplus: number; fiat: FiatCode; hourlyWage: number; asHours: boolean; onToggle: () => void;
}) {
  const sign = surplus >= 0 ? "+" : "−";
  const abs = Math.abs(surplus);
  const hours = hourlyWage > 0 ? abs / hourlyWage : 0;
  const display = asHours ? `${sign}${hours.toFixed(1)} hrs` : `${sign}${fmtFiat(abs, fiat)}`;
  return (
    <div className="flex items-baseline justify-between py-4 gap-4">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        Surplus / deficit
        <button
          onClick={onToggle}
          className="text-[10px] uppercase tracking-[0.14em] border border-border px-1.5 py-0.5 hover:bg-foreground hover:text-background transition-colors"
          aria-label="Toggle surplus display"
          title={asHours ? "Show as currency" : "Show as hours"}
        >
          {asHours ? "hrs" : fiat === "NONE" ? "num" : fiat}
        </button>
      </dt>
      <dd className="font-display tabular text-xl md:text-2xl">{display}</dd>
    </div>
  );
}

// ---------- Tax Settings Dialog ----------
function TaxSettingsDialog({ tax, onChange }: { tax: TaxConfig; onChange: (t: TaxConfig) => void }) {
  const [draft, setDraft] = useState<TaxConfig>(tax);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) setDraft(tax); }, [open, tax]);
  const total = draft.federal + draft.state + draft.fica + draft.other;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 hover:bg-foreground hover:text-background transition-colors"
          aria-label="Tax settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-[0.14em]">Configure</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Tax & withholding</DialogTitle>
          <DialogDescription>
            Estimated rates applied to gross income. Adjust for your jurisdiction or use generic defaults.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {([
            ["federal", "Federal income tax"],
            ["state", "State / local tax"],
            ["fica", "FICA (Social Sec. + Medicare)"],
            ["other", "Other withholdings"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
              <div className="flex items-baseline gap-1 border-b border-border w-32">
                <input
                  type="number"
                  step={0.1}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) || 0 })}
                  className="tabular w-full bg-transparent text-lg font-display outline-none text-right"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </label>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total</span>
            <span className="font-display tabular text-xl">{total.toFixed(2)}%</span>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setDraft(DEFAULT_TAX)}>Reset to defaults</Button>
            <Button variant="outline" size="sm" onClick={() => setDraft({ federal: 0, state: 0, fica: 0, other: 0 })}>Zero out</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onChange(draft); setOpen(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Visualization Gallery ----------
type VizProps = {
  status: Status; ratio: number; surplus: number;
  income: number; expenses: number; fiat: FiatCode;
};

function VisualizationGallery(props: VizProps & { initialIndex: number; onChange: (i: number) => void }) {
  const { initialIndex, onChange, ...vizProps } = props;
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(initialIndex);

  const slides = [
    { name: "Flame", node: <FlameViz {...vizProps} /> },
    { name: "Stopwatch", node: <StopwatchViz {...vizProps} /> },
    { name: "Greenspace", node: <GreenspaceViz {...vizProps} /> },
    { name: "Heartbeat", node: <HeartbeatViz {...vizProps} /> },
    { name: "Number", node: <BigNumberViz {...vizProps} /> },
    { name: "Grade", node: <GradeViz {...vizProps} /> },
    { name: "Atom", node: <AtomViz {...vizProps} /> },
  ];

  // Restore initial slide once api ready
  useEffect(() => {
    if (!api) return;
    if (initialIndex > 0) api.scrollTo(initialIndex, true);
    setCurrent(api.selectedScrollSnap());
    const handler = () => {
      const i = api.selectedScrollSnap();
      setCurrent(i);
      onChange(i);
    };
    api.on("select", handler);
    return () => { api.off("select", handler); };
  }, [api]);

  // Keyboard arrow navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); api?.scrollPrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); api?.scrollNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  return (
    <div className="relative">
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {slides.map((s, i) => (
            <CarouselItem key={i}>
              <div className="relative h-[360px] md:h-[440px] border border-border bg-card overflow-hidden">
                {s.node}
                <div className="absolute top-3 left-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · {s.name}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 md:-left-12" />
        <CarouselNext className="right-2 md:-right-12" />
      </Carousel>

      <div className="flex items-center justify-between mt-4 gap-4">
        <button
          onClick={() => api?.scrollPrev()}
          aria-label="Previous"
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Prev
        </button>
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? "w-6 bg-foreground" : "w-1.5 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => api?.scrollNext()}
          aria-label="Next"
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          Next →
        </button>
      </div>
      <p className="text-center mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground tabular">
        {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")} · {slides[current]?.name}
      </p>
    </div>
  );
}

// ---------- Visualizations ----------
function StatusLabel({ status }: { status: Status }) {
  return (
    <div className="absolute bottom-3 right-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
      <span style={{ color: STATUS_COLOR[status] }}>{status}</span>
    </div>
  );
}

function FlameViz({ status, ratio }: VizProps) {
  const intensity = Math.min(Math.max(ratio, 0.3), 2);
  const speed = status === "deficit" ? "0.4s" : status === "thin" ? "0.9s" : "1.6s";
  const color = status === "deficit" ? "oklch(0.65 0.22 30)" : status === "thin" ? "oklch(0.78 0.18 70)" : "oklch(0.78 0.16 90)";
  return (
    <div className="absolute inset-0 flex items-end justify-center pb-12">
      <style>{`@keyframes flicker { 0%,100%{transform:scaleY(1) scaleX(1);} 25%{transform:scaleY(1.15) scaleX(0.92);} 50%{transform:scaleY(0.9) scaleX(1.08);} 75%{transform:scaleY(1.08) scaleX(0.95);} }`}</style>
      <svg width="240" height="320" viewBox="0 0 240 320">
        <defs>
          <radialGradient id="fl" cx="50%" cy="80%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="60%" stopColor={color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g style={{ transformOrigin: "120px 280px", animation: `flicker ${speed} ease-in-out infinite` }}>
          <path d={`M120 ${280 - 200 * intensity} C 60 ${260 - 100 * intensity}, 60 240, 120 280 C 180 240, 180 ${260 - 100 * intensity}, 120 ${280 - 200 * intensity} Z`} fill="url(#fl)" />
          <path d={`M120 ${280 - 130 * intensity} C 90 250, 90 240, 120 280 C 150 240, 150 250, 120 ${280 - 130 * intensity} Z`} fill={color} opacity="0.9" />
        </g>
        <ellipse cx="120" cy="290" rx="60" ry="6" fill="oklch(0.3 0.02 60)" opacity="0.3" />
      </svg>
      <StatusLabel status={status} />
    </div>
  );
}

function StopwatchViz({ status, ratio }: VizProps) {
  const speed = status === "deficit" ? "1.5s" : status === "thin" ? "4s" : "8s";
  const tickColor = STATUS_COLOR[status];
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <style>{`@keyframes sweep { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }`}</style>
      <svg width="280" height="280" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--color-border)" strokeWidth="2" />
        {Array.from({ length: 60 }).map((_, i) => (
          <line key={i} x1="100" y1="12" x2="100" y2={i % 5 === 0 ? "22" : "16"} stroke="var(--color-muted-foreground)" strokeWidth={i % 5 === 0 ? 1.5 : 0.5} transform={`rotate(${i * 6} 100 100)`} />
        ))}
        <g style={{ transformOrigin: "100px 100px", animation: `sweep ${speed} linear infinite` }}>
          <line x1="100" y1="100" x2="100" y2="20" stroke={tickColor} strokeWidth="2" />
          <circle cx="100" cy="20" r="4" fill={tickColor} />
        </g>
        <circle cx="100" cy="100" r="5" fill="var(--color-foreground)" />
        <text x="100" y="150" textAnchor="middle" className="tabular" fill="var(--color-muted-foreground)" fontSize="10" letterSpacing="2">
          {ratio.toFixed(2)}× RATIO
        </text>
      </svg>
      <StatusLabel status={status} />
    </div>
  );
}

function GreenspaceViz({ status }: VizProps) {
  const sky =
    status === "sustainable" ? "linear-gradient(180deg, oklch(0.85 0.08 220), oklch(0.95 0.04 90))"
    : status === "thin" ? "linear-gradient(180deg, oklch(0.7 0.04 240), oklch(0.85 0.02 90))"
    : "linear-gradient(180deg, oklch(0.35 0.03 260), oklch(0.5 0.04 250))";
  return (
    <div className="absolute inset-0" style={{ background: sky }}>
      <style>{`
        @keyframes drift { 0%{transform:translateX(-20px);} 100%{transform:translateX(20px);} }
        @keyframes rain { 0%{transform:translateY(-20px); opacity:0;} 20%{opacity:1;} 100%{transform:translateY(180px); opacity:0;} }
        @keyframes sway { 0%,100%{transform:rotate(-2deg);} 50%{transform:rotate(2deg);} }
        @keyframes shine { 0%,100%{opacity:0.6;} 50%{opacity:1;} }
      `}</style>
      <svg width="100%" height="100%" viewBox="0 0 600 440" preserveAspectRatio="xMidYMid slice">
        {status === "sustainable" && (
          <>
            <circle cx="500" cy="90" r="40" fill="oklch(0.92 0.15 90)" style={{ animation: "shine 3s ease-in-out infinite" }} />
            {["oklch(0.7 0.2 25)","oklch(0.8 0.18 65)","oklch(0.85 0.18 100)","oklch(0.7 0.18 150)","oklch(0.65 0.18 230)","oklch(0.55 0.2 290)"].map((c, i) => (
              <path key={i} d={`M 50 ${320 - i * 8} A 250 250 0 0 1 550 ${320 - i * 8}`} fill="none" stroke={c} strokeWidth="6" opacity="0.7" />
            ))}
          </>
        )}
        {status !== "sustainable" && (
          <g style={{ animation: "drift 6s ease-in-out infinite alternate" }}>
            <ellipse cx="150" cy="80" rx="70" ry="22" fill="oklch(0.4 0.02 260)" opacity="0.7" />
            <ellipse cx="380" cy="60" rx="90" ry="26" fill="oklch(0.35 0.02 260)" opacity="0.8" />
          </g>
        )}
        {status === "deficit" && (
          <>
            {Array.from({ length: 30 }).map((_, i) => (
              <line key={i} x1={50 + i * 18} y1="100" x2={45 + i * 18} y2="120" stroke="oklch(0.7 0.1 230)" strokeWidth="1.5" style={{ animation: `rain ${0.6 + (i % 5) * 0.1}s linear infinite`, animationDelay: `${(i % 7) * 0.15}s` }} />
            ))}
            <rect x="0" y="340" width="600" height="100" fill="oklch(0.45 0.08 230)" opacity="0.6" />
          </>
        )}
        <rect x="0" y="360" width="600" height="80" fill={status === "sustainable" ? "oklch(0.55 0.15 145)" : "oklch(0.4 0.06 130)"} />
        <g style={{ transformOrigin: "300px 360px", animation: "sway 3s ease-in-out infinite" }}>
          <rect x="290" y="280" width="20" height="90" fill="oklch(0.35 0.05 60)" />
          <circle cx="300" cy="260" r="60" fill={status === "deficit" ? "oklch(0.4 0.08 100)" : "oklch(0.55 0.16 145)"} />
          <circle cx="265" cy="240" r="35" fill={status === "deficit" ? "oklch(0.38 0.07 100)" : "oklch(0.5 0.16 150)"} />
          <circle cx="335" cy="245" r="38" fill={status === "deficit" ? "oklch(0.4 0.08 100)" : "oklch(0.55 0.16 140)"} />
        </g>
      </svg>
      <StatusLabel status={status} />
    </div>
  );
}

function HeartbeatViz({ status, ratio }: VizProps) {
  const speed = status === "deficit" ? "0.5s" : status === "thin" ? "1.2s" : "2s";
  const color = STATUS_COLOR[status];
  const flat = ratio < 0.4;
  const path = flat ? "M0 60 L600 60" : "M0 60 L120 60 L140 60 L160 30 L180 90 L200 20 L220 100 L240 60 L600 60";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[oklch(0.12_0.01_260)]">
      <style>{`
        @keyframes scroll { from{stroke-dashoffset:1200;} to{stroke-dashoffset:0;} }
        @keyframes pulse { 0%,100%{opacity:0.5;} 50%{opacity:1;} }
      `}</style>
      <svg width="100%" height="220" viewBox="0 0 600 120" preserveAspectRatio="none">
        {Array.from({ length: 30 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="120" stroke="oklch(0.2 0.05 150)" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 20} x2="600" y2={i * 20} stroke="oklch(0.2 0.05 150)" strokeWidth="0.5" />
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, strokeDasharray: 1200, animation: `scroll ${speed} linear infinite` }} />
      </svg>
      <p className="absolute bottom-10 font-display tabular text-2xl" style={{ color, animation: `pulse ${speed} ease-in-out infinite` }}>
        {flat ? "—— flatline ——" : `${(60 / parseFloat(speed)).toFixed(0)} bpm`}
      </p>
      <StatusLabel status={status} />
    </div>
  );
}

function BigNumberViz({ status, surplus, fiat }: VizProps) {
  const color = STATUS_COLOR[status];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
        Monthly {surplus >= 0 ? "surplus" : "deficit"}
      </p>
      <p className="font-display tabular leading-none text-center" style={{ color, fontSize: "clamp(64px, 14vw, 160px)" }}>
        {surplus >= 0 ? "+" : "−"}{fmtFiat(Math.abs(surplus), fiat)}
      </p>
      <StatusLabel status={status} />
    </div>
  );
}

function GradeViz({ status, ratio }: VizProps) {
  const grade = ratio >= 1.6 ? "A" : ratio >= 1.3 ? "B" : ratio >= 1.05 ? "C" : ratio >= 0.85 ? "D" : "F";
  const color = STATUS_COLOR[status];
  const note =
    grade === "A" ? "Outstanding margin." :
    grade === "B" ? "Comfortably solvent." :
    grade === "C" ? "Adequate. Watch carefully." :
    grade === "D" ? "Below sustainable threshold." :
    "Failing. Restructure required.";
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.97_0.01_80)] dark:bg-[oklch(0.16_0.01_80)]">
      <div className="text-center">
        <p className="font-display italic text-sm text-muted-foreground mb-2">Final mark</p>
        <div className="font-display leading-none mb-4" style={{ color, fontSize: "260px", textShadow: `0 4px 30px ${color}40` }}>
          {grade}
        </div>
        <p className="font-display italic text-base text-muted-foreground max-w-xs mx-auto">{note}</p>
      </div>
      <StatusLabel status={status} />
    </div>
  );
}

function AtomViz({ status, ratio }: VizProps) {
  const speed = status === "deficit" ? "1.2s" : status === "thin" ? "3s" : "6s";
  const color = STATUS_COLOR[status];
  const electrons = Math.max(2, Math.min(8, Math.round(ratio * 4)));
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <style>{`@keyframes orbit { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }`}</style>
      <svg width="360" height="360" viewBox="0 0 360 360">
        <circle cx="180" cy="180" r="14" fill={color} style={{ filter: `drop-shadow(0 0 14px ${color})` }} />
        {[0, 60, 120].map((angle, i) => (
          <g key={i} transform={`rotate(${angle} 180 180)`}>
            <ellipse cx="180" cy="180" rx="140" ry="50" fill="none" stroke="var(--color-border)" strokeWidth="1" />
            <g style={{ transformOrigin: "180px 180px", animation: `orbit ${speed} linear infinite`, animationDelay: `${i * 0.2}s` }}>
              {Array.from({ length: Math.ceil(electrons / 3) + (i < electrons % 3 ? 1 : 0) }).map((_, j, arr) => {
                const t = (j / arr.length) * Math.PI * 2;
                const x = 180 + Math.cos(t) * 140;
                const y = 180 + Math.sin(t) * 50;
                return <circle key={j} cx={x} cy={y} r="6" fill={color} />;
              })}
            </g>
          </g>
        ))}
      </svg>
      <StatusLabel status={status} />
    </div>
  );
}

// ---------- Income vs Expense Chart ----------
function IncomeExpenseChart({ income, expenses, fiat, status }: { income: number; expenses: number; fiat: FiatCode; status: Status }) {
  const data = [
    { name: "Income", value: Math.round(income), fill: STATUS_COLOR[status] },
    { name: "Expenses", value: Math.round(expenses), fill: "oklch(0.55 0.05 260)" },
  ];
  const max = Math.max(income, expenses) * 1.15;
  return (
    <div className="w-full h-[280px] md:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="name" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11, letterSpacing: 1.5 }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
          <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtFiat(v, fiat)} domain={[0, max]} axisLine={false} tickLine={false} width={80} />
          <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 4, fontSize: 12 }} formatter={(v: number) => fmtFiat(v, fiat)} />
          <ReferenceLine y={expenses} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" label={{ value: "Break-even", position: "right", fill: "var(--color-muted-foreground)", fontSize: 10 }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- Support button ----------
function SupportButton() {
  const [copied, setCopied] = useState<string | null>(null);
  const addresses = [
    { label: "BTC", value: "bc1qexamplebitcoinaddressreplaceme0000000" },
    { label: "ETH", value: "0xExampleEthereumAddressReplaceMe000000000" },
    { label: "SOL", value: "ExampleSolanaAddressReplaceMe00000000000" },
  ];
  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 border border-border px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors">
          <span className="tracking-[0.14em] uppercase text-[10px]">♡ Support</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Support development</DialogTitle>
          <DialogDescription>
            The Austin Equation is independent and ad-free. If it's useful to you, a small tip keeps it that way.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {addresses.map((a) => (
            <button key={a.label} onClick={() => copy(a.label, a.value)}
              className="w-full text-left flex items-center justify-between gap-3 border border-border px-3 py-2.5 hover:bg-muted transition-colors">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{a.label}</p>
                <p className="tabular text-xs truncate">{a.value}</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
                {copied === a.label ? "copied ✓" : "copy"}
              </span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Thank you.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- PDF Preview + Export ----------
type ExportData = {
  fiat: FiatCode; crypto: CryptoCode;
  expenses: number; wageAmount: number; payFreq: PayFreq; timeUnit: TimeUnit;
  hoursPerUnit: number; effort: number;
  hourlyWage: number; monthlyHours: number;
  income: number; gross: number; surplus: number; breakEvenHrs: number; ratio: number;
  status: Status; cryptoEquivalent: number;
  taxEnabled: boolean; taxRate: number;
};

function buildPDF(d: ExportData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 56;
  let y = 64;

  doc.setFont("times", "italic"); doc.setFontSize(10); doc.setTextColor(120);
  doc.text("AN INSTRUMENT FOR LABOR", M, y);
  y += 22;
  doc.setFont("times", "normal"); doc.setFontSize(24); doc.setTextColor(20);
  doc.text("The Austin Equation", M, y);
  y += 18;
  doc.setFont("times", "italic"); doc.setFontSize(11); doc.setTextColor(110);
  doc.text("M = E · T · C", M, y);

  y += 28;
  doc.setDrawColor(200); doc.line(M, y, W - M, y);
  y += 22;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(80);
  doc.text("STATUS", M, y);
  doc.setFont("times", "normal"); doc.setFontSize(20); doc.setTextColor(20);
  doc.text(d.status.toUpperCase(), M + 80, y + 2);
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(80);
  const sign = d.surplus >= 0 ? "+" : "-";
  doc.text(`${sign}${fmtFiat(Math.abs(d.surplus), d.fiat)} per month`, M + 80, y + 14);
  y += 36;

  const section = (title: string) => {
    y += 10;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(80);
    doc.text(title.toUpperCase(), M, y);
    y += 6;
    doc.setDrawColor(220); doc.line(M, y, W - M, y);
    y += 16;
  };
  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(label, M, y);
    doc.setFont("times", "normal"); doc.setFontSize(12); doc.setTextColor(20);
    doc.text(value, W - M, y, { align: "right" });
    y += 20;
  };

  section("I. Inputs");
  row("Fiat denomination", d.fiat);
  if (d.crypto !== "NONE") row("Crypto denomination", d.crypto);
  row("Monthly expenses (M)", fmtFiat(d.expenses, d.fiat));
  row("Wage / pay (C)", `${fmtFiat(d.wageAmount, d.fiat)} / ${d.payFreq}`);
  row("Time scale", d.timeUnit);
  row(`Work hours / ${d.timeUnit} (T)`, `${d.hoursPerUnit} hrs`);
  row("Effort multiplier (E)", `${d.effort.toFixed(2)}`);
  if (d.taxEnabled) row("Estimated tax rate", `${(d.taxRate * 100).toFixed(2)}%`);

  section("II. Reading");
  row("Effective hourly wage", fmtFiat(d.hourlyWage, d.fiat));
  row("Monthly hours worked", `${d.monthlyHours.toFixed(0)} hrs`);
  row("Gross monthly income", fmtFiat(d.gross, d.fiat));
  if (d.taxEnabled) row("Net (take-home) income", fmtFiat(d.income, d.fiat));
  row("Surplus / deficit", `${sign}${fmtFiat(Math.abs(d.surplus), d.fiat)}`);
  row("Break-even hours / mo.", `${d.breakEvenHrs.toFixed(1)} hrs`);
  row("Income / expense ratio", `${d.ratio.toFixed(2)}x`);
  if (d.crypto !== "NONE") {
    row(`Income in ${d.crypto}`, `${d.cryptoEquivalent.toFixed(d.crypto === "USDC" ? 2 : 6)} ${d.crypto}`);
  }

  doc.setFont("times", "italic"); doc.setFontSize(9); doc.setTextColor(140);
  doc.text(`"Money is the measure of effort exchanged for time."`, M, doc.internal.pageSize.getHeight() - 40);
  doc.text(new Date().toLocaleDateString(), W - M, doc.internal.pageSize.getHeight() - 40, { align: "right" });

  return doc;
}

function PdfPreviewButton({ data }: { data: ExportData }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const doc = buildPDF(data);
    const blobUrl = doc.output("bloburl") as unknown as string;
    setUrl(blobUrl.toString());
    return () => {
      // Revoke when closing
      try { URL.revokeObjectURL(blobUrl.toString()); } catch {}
      setUrl(null);
    };
  }, [open]);

  const download = () => {
    const doc = buildPDF(data);
    doc.save(`austin-equation-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 border border-border px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors">
          <span className="tracking-[0.14em] uppercase text-[10px]">Preview PDF</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] h-[88vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">PDF Summary Preview</DialogTitle>
          <DialogDescription>Review the document before downloading.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 border border-border bg-muted">
          {url ? (
            <iframe src={url} title="PDF preview" className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              Generating preview…
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={download}>Download PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
