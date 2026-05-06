import { type PointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/openui/dialog";
import { Button } from "@/components/openui/button";
import { Input } from "@/components/openui/input";
import { Label } from "@/components/openui/label";
import { Switch } from "@/components/openui/switch";
import { Select as OpenUISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/openui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/openui/card";
import { Separator } from "@/components/openui/separator";
import type { jsPDF as JsPDFDocument } from "jspdf";
import { ChevronDown, Settings as SettingsIcon, Share2, Printer, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

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
const STORAGE_KEY = "austin-equation:v3";

type ExpenseKey =
  | "rent"
  | "groceries"
  | "transportation"
  | "healthInsurance"
  | "contingency"
  | "savings"
  | "recreational";

type ExpenseItems = Record<ExpenseKey, number>;

const EXPENSE_FIELDS: Array<{ key: ExpenseKey; label: string }> = [
  { key: "rent", label: "Rent" },
  { key: "groceries", label: "Groceries" },
  { key: "transportation", label: "Transportation" },
  { key: "healthInsurance", label: "Health insurance" },
  { key: "contingency", label: "Contingency" },
  { key: "savings", label: "Savings" },
  { key: "recreational", label: "Recreational" },
];

const DEFAULT_EXPENSE_ITEMS: ExpenseItems = {
  rent: 1500,
  groceries: 450,
  transportation: 250,
  healthInsurance: 350,
  contingency: 200,
  savings: 300,
  recreational: 150,
};

const DEFAULTS = {
  fiat: "USD" as FiatCode,
  crypto: "NONE" as CryptoCode,
  expenses: 3200,
  expenseItems: DEFAULT_EXPENSE_ITEMS,
  wageAmount: 1120,
  payFreq: "weekly" as PayFreq,
  timeUnit: "week" as TimeUnit,
  hoursPerUnit: 40,
  effort: 1,
  taxEnabled: true,
  tax: DEFAULT_TAX,
  slide: 0,
  surplusAsHours: false,
  graphsAsHours: false,
  visualizationAsHours: false,
  collapsedSections: {} as Record<string, boolean>,
};

function loadState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function persistSlideIndex(index: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const next = raw ? JSON.parse(raw) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, slide: index }));
  } catch {
    // Slide persistence is a convenience; navigation should never depend on it.
  }
}

// Encode/decode share state
function encodeShare(state: typeof DEFAULTS): string {
  try {
    const json = JSON.stringify(state);
    return btoa(unescape(encodeURIComponent(json)));
  } catch { return ""; }
}
function decodeShare(s: string): Partial<typeof DEFAULTS> | null {
  try {
    const json = decodeURIComponent(escape(atob(s)));
    return JSON.parse(json);
  } catch { return null; }
}
function readShareFromUrl(): Partial<typeof DEFAULTS> | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const s = params.get("s");
  return s ? decodeShare(s) : null;
}

function normalizeExpenseItems(raw: Partial<ExpenseItems> | undefined, fallbackTotal: number): ExpenseItems {
  if (raw && typeof raw === "object") {
    return EXPENSE_FIELDS.reduce((items, field) => {
      const value = Number(raw[field.key]);
      items[field.key] = Number.isFinite(value) ? Math.max(0, value) : DEFAULT_EXPENSE_ITEMS[field.key];
      return items;
    }, {} as ExpenseItems);
  }

  if (Number.isFinite(fallbackTotal) && fallbackTotal !== DEFAULTS.expenses) {
    return { ...DEFAULT_EXPENSE_ITEMS, rent: Math.max(0, fallbackTotal - (DEFAULTS.expenses - DEFAULT_EXPENSE_ITEMS.rent)) };
  }

  return { ...DEFAULT_EXPENSE_ITEMS };
}

// ---------- Component ----------
export default function Index() {
  const persisted = loadState(STORAGE_KEY, DEFAULTS);
  const shared = typeof window !== "undefined" ? readShareFromUrl() : null;
  const initial = { ...persisted, ...(shared || {}) };
  const initialExpenseItems = normalizeExpenseItems(initial.expenseItems, initial.expenses);

  const [fiat, setFiat] = useState<FiatCode>(initial.fiat);
  const [crypto, setCrypto] = useState<CryptoCode>(initial.crypto);
  const [expenseItems, setExpenseItems] = useState<ExpenseItems>(initialExpenseItems);
  const [wageAmount, setWageAmount] = useState<number>(initial.wageAmount);
  const [payFreq, setPayFreq] = useState<PayFreq>(initial.payFreq);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>(initial.timeUnit);
  const [hoursPerUnit, setHoursPerUnit] = useState<number>(initial.hoursPerUnit);
  const [effort, setEffort] = useState<number>(initial.effort);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(initial.taxEnabled);
  const [tax, setTax] = useState<TaxConfig>(initial.tax);
  const currentSlideRef = useRef<number>(initial.slide);
  const [surplusAsHours, setSurplusAsHours] = useState<boolean>(initial.surplusAsHours);
  const [visualizationAsHours, setVisualizationAsHours] = useState<boolean>(initial.visualizationAsHours);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(initial.collapsedSections || {});
  const expenses = useMemo(
    () => EXPENSE_FIELDS.reduce((total, field) => total + (Number(expenseItems[field.key]) || 0), 0),
    [expenseItems],
  );
  const updateExpenseItem = (key: ExpenseKey, value: number) => {
    setExpenseItems((items) => ({ ...items, [key]: Math.max(0, value) }));
  };
  const toggleSection = (key: string) => {
    setCollapsedSections((sections) => ({ ...sections, [key]: !sections[key] }));
  };

  // If we got state from URL, persist it then strip the param
  useEffect(() => {
    if (shared && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("s");
      window.history.replaceState({}, "", url.toString());
      toast.success("Shared scenario loaded");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          fiat, crypto, expenses, expenseItems, wageAmount, payFreq, timeUnit,
          hoursPerUnit, effort, taxEnabled, tax, slide: currentSlideRef.current,
          surplusAsHours, graphsAsHours: visualizationAsHours, visualizationAsHours, collapsedSections,
        }),
      );
    } catch {
      // Ignore storage failures in private browsing or locked-down browsers.
    }
  }, [fiat, crypto, expenses, expenseItems, wageAmount, payFreq, timeUnit, hoursPerUnit, effort, taxEnabled, tax, surplusAsHours, visualizationAsHours, collapsedSections]);

  const taxRate = taxEnabled ? Math.max(0, Math.min(100, tax.federal + tax.state + tax.fica + tax.other)) / 100 : 0;

  const { gross, income, surplus, breakEvenHrs, ratio, status, hourlyWage, netHourlyWage, monthlyHours, hourlyRequired } = useMemo(() => {
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
    const requiredNetHourly = monthlyHours > 0 && effort > 0 ? (expenses * 1.2) / (monthlyHours * effort) : 0;
    const hourlyRequired = taxRate < 1 ? requiredNetHourly / (1 - taxRate) : 0;
    return { gross, income, surplus, breakEvenHrs, ratio, status, hourlyWage, netHourlyWage, monthlyHours, hourlyRequired };
  }, [expenses, wageAmount, payFreq, hoursPerUnit, timeUnit, effort, taxRate]);

  // Crypto equivalents
  const usdRate = fiat === "NONE" ? 1 : FIAT_PER_USD[fiat];
  const incomeUSD = income / usdRate;
  const cryptoEquivalent = crypto === "NONE" ? 0 : incomeUSD / USD_PER_CRYPTO[crypto];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-16">
        {/* Masthead */}
        <header className="flex flex-col md:flex-row md:items-baseline justify-between pb-6 gap-2">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">The Austin Equation</h1>
            <p className="text-muted-foreground mt-1">
              Find What's Missing
            </p>
          </div>
          <p className="hidden md:block text-muted-foreground tabular-nums font-mono text-sm">
            M = E · T · C
          </p>
        </header>
        <Separator className="mb-8" />

        {/* Hero */}
        <CollapsibleSection
          title="Visualization"
          collapsed={!!collapsedSections.visualization}
          onToggle={() => toggleSection("visualization")}
          className="mb-8 overflow-hidden"
          contentClassName="p-0 border-t"
          headerAction={
            <div className="flex items-center space-x-2">
              <Switch
                id="visualization-time-mode"
                checked={visualizationAsHours}
                onCheckedChange={setVisualizationAsHours}
              />
              <Label htmlFor="visualization-time-mode" className="cursor-pointer text-sm font-medium leading-none">
                View as time
              </Label>
            </div>
          }
        >
          <VisualizationGallery
            status={status}
            ratio={ratio}
            surplus={surplus}
            income={income}
            expenses={expenses}
            fiat={fiat}
            crypto={crypto}
            cryptoEquivalent={cryptoEquivalent}
            hourlyWage={netHourlyWage}
            hourlyRequired={hourlyRequired}
            visualizationAsHours={visualizationAsHours}
            initialIndex={currentSlideRef.current}
            onChange={(index) => {
              currentSlideRef.current = index;
              persistSlideIndex(index);
            }}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Expenses"
          collapsed={!!collapsedSections.expenseBreakdown}
          onToggle={() => toggleSection("expenseBreakdown")}
          className="mb-8"
          headerAction={
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Monthly total</p>
              <p className="text-lg font-semibold tabular-nums">{fmtFiat(expenses, fiat)}</p>
            </div>
          }
        >
          <ExpenseBreakdown
            items={expenseItems}
            fiat={fiat}
            total={expenses}
            onChange={updateExpenseItem}
          />
        </CollapsibleSection>

        {/* Inputs & wage gap */}
        <div className="grid gap-8 lg:grid-cols-2 mb-8">
          <CollapsibleSection
            title="Paycheck"
            collapsed={!!collapsedSections.inputs}
            onToggle={() => toggleSection("inputs")}
          >
              <div className="grid grid-cols-1 gap-x-6 gap-y-6 mb-8 sm:grid-cols-2">
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

              <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
                <CurrencyTotalField label="Monthly expenses (M)" value={expenses} fiat={fiat} />
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

              <Separator className="my-6" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="tax-mode"
                    checked={taxEnabled}
                    onCheckedChange={setTaxEnabled}
                  />
                  <Label htmlFor="tax-mode" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    Apply estimated taxes {taxEnabled && `(${(taxRate * 100).toFixed(1)}%)`}
                  </Label>
                </div>
                <TaxSettingsDialog tax={tax} onChange={setTax} />
              </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Results"
            collapsed={!!collapsedSections.wageGap}
            onToggle={() => toggleSection("wageGap")}
          >
              <dl className="divide-y divide-border">
                <Row label="Hourly Wage Required" value={fmtFiat(hourlyRequired, fiat)} />
                <Row label="Current Hourly Wage" value={fmtFiat(hourlyWage, fiat)} />
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
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <footer className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="font-display italic">
            "Money is the measure of effort exchanged for time."
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <ShareButton state={{
              fiat, crypto, expenses, expenseItems, wageAmount, payFreq, timeUnit,
              hoursPerUnit, effort, taxEnabled, tax, slide: currentSlideRef.current, surplusAsHours, graphsAsHours: visualizationAsHours, visualizationAsHours, collapsedSections,
            }} />
            <ResetButton onReset={() => {
              try {
                localStorage.removeItem(STORAGE_KEY);
              } catch {
                // Reset still works through reload when storage access is blocked.
              }
              window.location.reload();
            }} />
            <PdfPreviewButton
              data={{
                fiat, crypto, expenses, wageAmount, payFreq, timeUnit,
                hoursPerUnit, effort, hourlyWage, monthlyHours,
                income, gross, surplus, breakEvenHrs, ratio, status, cryptoEquivalent, hourlyRequired,
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

function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  headerAction,
  children,
  className = "",
  contentClassName = "",
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="relative space-y-0 p-6">
        <div className="flex flex-row items-center justify-between gap-4 pr-12">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {headerAction}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
          aria-expanded={!collapsed}
          className="absolute right-4 top-4 h-9 w-9 rounded-full"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </Button>
      </CardHeader>
      {!collapsed && (
        <CardContent className={contentClassName || "pt-0"}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function NumberField({ label, suffix, value, onChange, step = 1, readOnly = false }: {
  label: string; suffix?: string; value: number; onChange: (v: number) => void; step?: number; readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(String(Number.isFinite(value) ? value : 0));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(Number.isFinite(value) ? value : 0));
  }, [focused, value]);

  const commit = () => {
    const next = parseFloat(draft);
    const normalized = Number.isFinite(next) ? next : 0;
    setDraft(String(normalized));
    onChange(normalized);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          value={draft}
          onFocus={() => setFocused(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          readOnly={readOnly}
          aria-readonly={readOnly}
          className={`${suffix ? "pr-12 " : ""}tabular-nums font-medium ${readOnly ? "bg-muted/50 text-muted-foreground" : ""}`}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm font-medium">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

function CurrencyTotalField({ label, value, fiat }: { label: string; value: number; fiat: FiatCode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Input
        type="text"
        value={fmtFiat(value, fiat)}
        readOnly
        aria-readonly="true"
        className="tabular-nums font-medium bg-muted/50 text-muted-foreground"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <OpenUISelect value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full capitalize tabular-nums font-medium">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize tabular-nums">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </OpenUISelect>
    </div>
  );
}

function CurrencyInputField({ label, value, fiat, onChange, flat = false }: {
  label: string; value: number; fiat: FiatCode; onChange: (value: number) => void; flat?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value ? String(value) : "");
  useEffect(() => {
    if (!focused) setDraft(value ? String(value) : "");
  }, [focused, value]);
  const commit = () => {
    const clean = draft.replace(/[^\d.]/g, "");
    const next = parseFloat(clean);
    onChange(Number.isFinite(next) ? next : 0);
  };
  const displayValue = focused ? draft : fmtFiat(value, fiat);
  return (
    <div className={`flex flex-col gap-3 rounded-lg border border-border bg-background/70 p-4 ${flat ? "shadow-none" : "shadow-sm"}`}>
      <Label className="text-muted-foreground">{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={(event) => {
          setDraft(value ? String(value) : "");
          setFocused(true);
          requestAnimationFrame(() => event.currentTarget.select());
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="h-11 px-4 text-lg tabular-nums font-semibold"
      />
    </div>
  );
}

function ExpenseBreakdown({ items, fiat, total, onChange }: {
  items: ExpenseItems; fiat: FiatCode; total: number; onChange: (key: ExpenseKey, value: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {EXPENSE_FIELDS.map((field) => (
          <CurrencyInputField
            key={field.key}
            label={field.label}
            fiat={fiat}
            value={items[field.key]}
            flat
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Accumulated monthly expenses</p>
          <p className="text-xs text-muted-foreground">This total feeds Monthly expenses (M) in Paycheck.</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{fmtFiat(total, fiat)}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
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
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
        Surplus / deficit
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="h-6 px-2 text-[10px] uppercase tracking-wider"
          aria-label="Toggle surplus display"
          title={asHours ? "Show as currency" : "Show as hours"}
        >
          {asHours ? "hrs" : fiat === "NONE" ? "num" : fiat}
        </Button>
      </dt>
      <dd className="min-w-0 break-words text-right text-base font-semibold tabular-nums sm:text-lg">{display}</dd>
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
        <Button variant="outline" size="sm" className="gap-1.5" aria-label="Tax settings">
          <SettingsIcon className="h-4 w-4" />
          <span>Configure Tax</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tax & Withholding</DialogTitle>
          <DialogDescription>
            Estimated rates applied to gross income. Adjust for your jurisdiction or use generic defaults.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {([
            ["federal", "Federal income tax"],
            ["state", "State / local tax"],
            ["fica", "FICA (Social Sec. + Medicare)"],
            ["other", "Other withholdings"],
          ] as const).map(([key, label]) => (
            <div key={key} className="grid grid-cols-4 items-center gap-4">
              <Label className="col-span-2 text-muted-foreground">{label}</Label>
              <div className="col-span-2 relative">
                <Input
                  type="number"
                  step={0.1}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) || 0 })}
                  className="pr-8 tabular-nums font-medium text-right"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm font-medium">
                  %
                </div>
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="tabular-nums font-bold text-lg">{total.toFixed(2)}%</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setDraft(DEFAULT_TAX)}>Defaults</Button>
            <Button variant="secondary" size="sm" onClick={() => setDraft({ federal: 0, state: 0, fica: 0, other: 0 })}>Zero</Button>
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
  crypto: CryptoCode; cryptoEquivalent: number;
  hourlyWage: number; hourlyRequired: number; visualizationAsHours: boolean;
};

function VisualizationGallery(props: VizProps & { initialIndex: number; onChange: (i: number) => void }) {
  const { initialIndex, onChange, ...vizProps } = props;
  const slides = [
    { name: "Hourly Wage Required", node: <HourlyRequiredViz {...vizProps} /> },
    { name: "Digital Timer", node: <DigitalTimerWatchViz {...vizProps} /> },
    { name: "Graphs", node: <GraphVizSlide {...vizProps} /> },
    { name: "Battery", node: <BatteryReserveViz {...vizProps} /> },
    { name: "Grade", node: <GradeViz {...vizProps} /> },
    { name: "Crypto", node: <CryptoIncomeViz {...vizProps} /> },
  ];
  const slideCount = slides.length;
  const initialSlideIndex = Math.min(Math.max(initialIndex, 0), slideCount - 1);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ active: false, pointerId: -1, startX: 0, deltaX: 0 });
  const [current, setCurrent] = useState(initialSlideIndex);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setCurrent(initialSlideIndex);
  }, [initialSlideIndex]);

  const goTo = useCallback((i: number) => {
    const next = Math.min(Math.max(i, 0), slideCount - 1);
    setCurrent(next);
    onChange(next);
  }, [onChange, slideCount]);
  const goPrev = useCallback(() => { goTo(current - 1); }, [current, goTo]);
  const goNext = useCallback(() => { goTo(current + 1); }, [current, goTo]);

  // Global keyboard arrow navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "Home") { e.preventDefault(); goTo(0); }
      else if (e.key === "End") { e.preventDefault(); goTo(slideCount - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, goTo, slideCount]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { active: true, pointerId: event.pointerId, startX: event.clientX, deltaX: 0 };
    setIsDragging(true);
    setDragX(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const rawDelta = event.clientX - drag.startX;
    const atEdge = (current === 0 && rawDelta > 0) || (current === slideCount - 1 && rawDelta < 0);
    const delta = atEdge ? rawDelta * 0.28 : rawDelta;
    drag.deltaX = delta;
    setDragX(delta);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const width = viewportRef.current?.clientWidth || 1;
    const threshold = Math.min(120, Math.max(54, width * 0.18));
    const delta = drag.deltaX;
    dragRef.current = { active: false, pointerId: -1, startX: 0, deltaX: 0 };
    setIsDragging(false);
    setDragX(0);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (Math.abs(delta) > threshold) {
      goTo(delta < 0 ? current + 1 : current - 1);
    }
  };

  const activeName = slides[current]?.name ?? "";
  const announcement = `Slide ${current + 1} of ${slideCount}: ${activeName}. Status ${vizProps.status}.`;
  const trackTransform = `translate3d(calc(${-current * 100}% + ${dragX}px), 0, 0)`;

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label="Financial visualizations">
      <div
        ref={viewportRef}
        className="ae-viz-viewport rounded-lg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div
          className="ae-viz-track"
          style={{
            transform: trackTransform,
            transition: isDragging ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {slides.map((s, i) => (
            <div key={i} className="ae-viz-slide">
              <div
                tabIndex={i === current ? 0 : -1}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${slideCount}: ${s.name} — ${vizProps.status}`}
                className="relative h-[360px] md:h-[440px] border border-border bg-card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-foreground"
              >
                {s.node}
                <div className="absolute top-3 left-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {s.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live region for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="flex items-center justify-between mt-4 gap-4">
        <button
          onClick={goPrev}
          disabled={current === 0}
          aria-label="Previous slide"
          className="rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
        >
          ← Prev
        </button>
        <div className="flex items-center gap-1.5" role="tablist">
          {slides.map((s, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-current={i === current ? "true" : undefined}
              aria-label={`Go to slide ${i + 1}: ${s.name}`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? "w-6 bg-foreground" : "w-1.5 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
        <button
          onClick={goNext}
          disabled={current === slideCount - 1}
          aria-label="Next slide"
          className="rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
        >
          Next →
        </button>
      </div>
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

function HourlyRequiredViz({ status, hourlyRequired, fiat }: VizProps) {
  const color = STATUS_COLOR[status];
  const hourlyLabel = `${fmtFiat(hourlyRequired, fiat)}/hr`;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-6 py-12 bg-background">
      <div className="mx-auto w-full max-w-[820px] text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Hourly Wage Required
        </p>
        <p
          className="mt-6 break-words font-semibold leading-none tracking-normal tabular-nums"
          style={{ color, fontSize: "clamp(4.25rem, 17vw, 10.5rem)" }}
        >
          {hourlyLabel}
        </p>
        <p className="mx-auto mt-5 max-w-[34rem] text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground md:text-base">
          To be sustainable after estimated taxes
        </p>
      </div>
      <StatusLabel status={status} />
    </div>
  );
}

function formatSurplusContext(surplus: number, fiat: FiatCode, hourlyWage: number, asHours: boolean) {
  const sign = surplus >= 0 ? "+" : "−";
  const abs = Math.abs(surplus);
  if (!asHours) return `${sign}${fmtFiat(abs, fiat)}`;
  const hours = hourlyWage > 0 ? abs / hourlyWage : 0;
  return `${sign}${hours.toFixed(1)} hrs`;
}

function decomposeLaborDuration(surplus: number, hourlyWage: number) {
  const totalSeconds = hourlyWage > 0 ? Math.round((Math.abs(surplus) / hourlyWage) * 3600) : 0;
  const days = Math.min(9999, Math.floor(totalSeconds / 86400));
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function padTimer(value: number, digits: number) {
  return String(value).padStart(digits, "0");
}

function DigitalTimerWatchViz({ status, ratio, surplus, fiat, hourlyWage, visualizationAsHours }: VizProps) {
  const label = surplus >= 0 ? "SURPLUS" : "DEFICIT";
  const duration = decomposeLaborDuration(surplus, hourlyWage);
  const value = formatSurplusContext(surplus, fiat, hourlyWage, visualizationAsHours);

  const displayContent = visualizationAsHours ? (
	    <div
	      className="grid items-end gap-4 md:gap-6"
	      style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
	    >
      {[
        { label: "DAY", value: duration.days },
        { label: "HR", value: duration.hours },
        { label: "MIN", value: duration.minutes },
        { label: "SEC", value: duration.seconds },
      ].map((part) => (
		        <div key={part.label} className="flex min-w-0 flex-col items-center justify-end px-3 py-5 md:px-5 md:py-7">
	          <p
	            className="font-mono font-bold leading-none tracking-normal tabular-nums"
	            style={{ color: "oklch(0.22 0.02 250)", fontSize: "clamp(1.85rem, 8vw, 6.4rem)" }}
          >
            {padTimer(part.value, 2)}
          </p>
          <p
            className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] md:text-2xl"
            style={{ color: "oklch(0.33 0.03 190)" }}
          >
            {part.label}
          </p>
        </div>
      ))}
    </div>
  ) : (
		    <div className="flex min-h-[150px] flex-col items-center justify-center px-8 py-12 text-center md:min-h-[190px] md:px-14 md:py-14">
      <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "oklch(0.45 0.02 250)" }}>
        {label}
      </p>
      <p
        className="max-w-full break-words font-mono font-bold leading-none tracking-normal tabular-nums"
        style={{ color: "oklch(0.22 0.02 250)", fontSize: "clamp(2.5rem, 12vw, 6.4rem)" }}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden px-4 py-8"
      style={{ backgroundColor: "oklch(0.98 0 0)", color: "oklch(0.24 0.02 240)" }}
    >
	      <div
		        className="relative z-10 w-full max-w-[900px] rounded-[1.8rem] p-6 sm:p-8 md:p-10"
		        style={{
		          backgroundColor: "oklch(0.96 0 0)",
		        }}
		      >
		        <div
		          className="rounded-xl px-8 py-10 shadow-inner md:px-14 md:py-12"
	          style={{ backgroundColor: "oklch(0.93 0.004 250)" }}
	        >
          {displayContent}
          <div className="mt-3 flex items-center justify-between gap-4 border-t pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] md:text-xs"
            style={{ borderColor: "oklch(0.68 0.004 250 / 0.65)", color: "oklch(0.33 0.02 250)" }}
          >
            <span>{label} {visualizationAsHours ? "time" : "value"}</span>
            <span>{ratio.toFixed(2)}x ratio</span>
          </div>
        </div>
      </div>
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

function formatCryptoValue(value: number, crypto: CryptoCode) {
  if (crypto === "NONE") return "No crypto selected";
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: crypto === "USDC" ? 2 : 6,
    minimumFractionDigits: crypto === "USDC" ? 2 : 4,
  })} ${crypto}`;
}

function GraphVizSlide({ income, expenses, fiat, status, visualizationAsHours, hourlyWage }: VizProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-4 py-12">
      <div className="h-full w-full max-w-[760px] rounded-xl bg-card/60 px-2 py-8 sm:px-6">
        <IncomeExpenseChart
          income={income}
          expenses={expenses}
          fiat={fiat}
          status={status}
          graphsAsHours={visualizationAsHours}
          hourlyWage={hourlyWage}
        />
      </div>
    </div>
  );
}

function BatteryReserveViz({ status, surplus, fiat, hourlyWage, visualizationAsHours }: VizProps) {
  const netHours = hourlyWage > 0 ? surplus / hourlyWage : 0;
  const absHours = Math.abs(netHours);
  const days = absHours / 24;
  const capacityDays = 7;
  const fillPercent = Math.min(100, (days / capacityDays) * 100);
  const isSurplus = surplus >= 0;
  const color = isSurplus ? "oklch(0.68 0.18 145)" : "oklch(0.62 0.22 28)";
  const glow = isSurplus ? "oklch(0.72 0.18 145 / 0.38)" : "oklch(0.64 0.22 28 / 0.38)";
  const displayValue = visualizationAsHours
    ? `${isSurplus ? "+" : "−"}${absHours.toFixed(1)} hrs`
    : `${isSurplus ? "+" : "−"}${fmtFiat(Math.abs(surplus), fiat)}`;
  const wholeDays = Math.floor(days);
  const remainingHours = Math.round(absHours % 24);
  const cells = Array.from({ length: capacityDays }, (_, i) => i);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[oklch(0.98_0_0)] px-4 py-10">
      <div className="w-full max-w-[820px]">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              24-hour reserve
            </p>
            <p className="mt-2 font-mono text-[clamp(2rem,8vw,4.8rem)] font-bold leading-none tabular-nums" style={{ color }}>
              {displayValue}
            </p>
          </div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-right">
            {wholeDays}d {remainingHours}h {isSurplus ? "stored" : "short"}
          </p>
        </div>

        <div className="relative mx-auto flex w-full max-w-[720px] items-center gap-2 sm:gap-3">
          <div
            className="relative h-32 flex-1 overflow-hidden rounded-[1.65rem] bg-[linear-gradient(145deg,oklch(0.99_0_0),oklch(0.88_0.006_250))] p-3 sm:h-40 sm:p-4"
            style={{
              boxShadow: "inset 0 2px 5px rgb(255 255 255 / .95), inset 0 -12px 24px rgb(0 0 0 / .08), 0 18px 36px rgb(0 0 0 / .12)",
            }}
          >
            <div className="absolute inset-x-8 top-3 h-4 rounded-full bg-white/65 blur-[1px]" />
            <div className="relative h-full overflow-hidden rounded-[1.2rem] bg-[linear-gradient(180deg,oklch(0.92_0.01_140),oklch(0.80_0.012_140))] shadow-inner">
              <div
                className="absolute inset-y-0 transition-[width] duration-500 ease-out"
                style={{
                  [isSurplus ? "left" : "right"]: 0,
                  width: `${fillPercent}%`,
                  background: isSurplus
                    ? "linear-gradient(90deg, oklch(0.58 0.16 145), oklch(0.78 0.19 145))"
                    : "linear-gradient(270deg, oklch(0.56 0.2 28), oklch(0.72 0.22 28))",
                  boxShadow: `0 0 32px ${glow}`,
                }}
              />
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${capacityDays}, minmax(0, 1fr))` }}>
                {cells.map((cell) => (
                  <div key={cell} className="border-r border-white/55 last:border-r-0" />
                ))}
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255_/_0.38),transparent_38%,rgb(0_0_0_/_0.08))]" />
            </div>
          </div>
          <div
            className="h-16 w-5 rounded-r-xl bg-[linear-gradient(145deg,oklch(0.96_0_0),oklch(0.78_0.006_250))] sm:h-20 sm:w-7"
            style={{ boxShadow: "inset 0 2px 4px rgb(255 255 255 / .85), inset -4px -6px 10px rgb(0 0 0 / .1)" }}
          />
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:gap-2 sm:text-[10px]">
          {cells.map((cell) => (
            <div key={cell} className="text-center">{cell + 1}d</div>
          ))}
        </div>
      </div>
      <StatusLabel status={status} />
    </div>
  );
}

function CryptoIncomeViz({ status, fiat, crypto, cryptoEquivalent, income }: VizProps) {
  const color = STATUS_COLOR[status];
  const hasCrypto = crypto !== "NONE";
  const fiatValue = fmtFiat(income, fiat);
  const cryptoLabel = formatCryptoValue(cryptoEquivalent, crypto);
  const markerPosition = hasCrypto ? Math.max(10, Math.min(90, cryptoEquivalent * 18)) : 50;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-5 py-10">
      <div className="w-full max-w-[760px]">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Income in cryptocurrency
            </p>
            <p className="mt-2 break-words font-mono text-[clamp(2.2rem,10vw,5.8rem)] font-bold leading-none tabular-nums" style={{ color }}>
              {cryptoLabel}
            </p>
          </div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-right">
            {fiatValue} monthly
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
          <div className="relative h-4 rounded-full bg-background shadow-inner">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${markerPosition}%`, backgroundColor: color }}
            />
            <div
              className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-background shadow-lg"
              style={{ left: `${markerPosition}%`, backgroundColor: color }}
            />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="uppercase tracking-[0.16em] text-muted-foreground">Asset</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">{crypto}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.16em] text-muted-foreground">Monthly net</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">{fiatValue}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.16em] text-muted-foreground">Converted</p>
              <p className="mt-1 break-words font-mono text-lg font-bold tabular-nums">{cryptoLabel}</p>
            </div>
          </div>
        </div>
      </div>
      <StatusLabel status={status} />
    </div>
  );
}

// ---------- Income vs Expense Chart ----------
function IncomeExpenseChart({ income, expenses, fiat, status, graphsAsHours, hourlyWage }: {
  income: number; expenses: number; fiat: FiatCode; status: Status;
  graphsAsHours: boolean; hourlyWage: number;
}) {
  const surplus = income - expenses;
  // When showing in hours, convert dollar amounts into hours-worked equivalents.
  const toHours = (v: number) => (hourlyWage > 0 ? v / hourlyWage : 0);
  const fmt = (v: number) => graphsAsHours ? `${v.toFixed(1)} hrs` : fmtFiat(v, fiat);

  const data = graphsAsHours
    ? [
        { name: "Income", value: +toHours(income).toFixed(1) },
        { name: "Expenses", value: +toHours(expenses).toFixed(1) },
      ]
    : [
        { name: "Income", value: Math.round(income) },
        { name: "Expenses", value: Math.round(expenses) },
      ];
  const max = Math.max(data[0].value, data[1].value, 1) * 1.15;
  const width = 640;
  const height = 280;
  const pad = { top: 28, right: 30, bottom: 46, left: 86 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const pointX = (index: number) => pad.left + index * plotW;
  const pointY = (value: number) => pad.top + plotH - (value / max) * plotH;
  const points = data.map((d, index) => ({ ...d, x: pointX(index), y: pointY(d.value) }));
  const ticks = [0, max / 2, max];
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  const refY = graphsAsHours ? toHours(expenses) : expenses;
  const refLabel = graphsAsHours
    ? `Break-even · ${toHours(expenses).toFixed(1)} hrs`
    : `Break-even · ${fmtFiat(expenses, fiat)}`;
  const surplusLabelY = graphsAsHours ? toHours(income) : income;
  const surplusDisplayValue = graphsAsHours ? toHours(Math.abs(surplus)) : Math.abs(surplus);
  const surplusLabelText = surplus >= 0
    ? `Surplus +${fmt(surplusDisplayValue)}`
    : `Deficit −${fmt(surplusDisplayValue)}`;

  return (
    <div className="w-full h-[280px] md:h-[340px]">
      <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Income and expenses line graph">
        <g className="font-mono">
          {ticks.map((tick) => {
            const y = pointY(tick);
            return (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="2 4" />
                <text x={pad.left - 12} y={y + 4} textAnchor="end" fontSize="11" fill="var(--color-muted-foreground)">
                  {graphsAsHours ? `${Math.round(tick)}h` : fmtFiat(tick, fiat)}
                </text>
              </g>
            );
          })}
          <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--color-border)" />
          <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-border)" />
          <line x1={pad.left} x2={width - pad.right} y1={pointY(refY)} y2={pointY(refY)} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
          <text x={width - pad.right} y={pointY(refY) - 8} textAnchor="end" fontSize="10" fill="var(--color-muted-foreground)">
            {refLabel}
          </text>
          <line x1={pad.left} x2={width - pad.right} y1={pointY(surplusLabelY)} y2={pointY(surplusLabelY)} stroke={STATUS_COLOR[status]} strokeDasharray="2 2" />
          <text x={pad.left} y={pointY(surplusLabelY) - 8} fontSize="10" fill={STATUS_COLOR[status]}>
            {surplusLabelText}
          </text>
          <path d={linePath} fill="none" stroke={STATUS_COLOR[status]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={point.name}>
              <circle cx={point.x} cy={point.y} r="7" fill="var(--color-background)" stroke={STATUS_COLOR[status]} strokeWidth="3" />
              <text x={point.x} y={pad.top + plotH + 26} textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="var(--color-muted-foreground)">
                {point.name}
              </text>
              <text x={point.x} y={point.y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-foreground)">
                {fmt(point.value)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ---------- QR codes ----------
const QR_VERSION = 4;
const QR_SIZE = 17 + QR_VERSION * 4;
const QR_DATA_CODEWORDS = 80;
const QR_ECC_CODEWORDS = 20;

const QR_MASKS = [
  (x: number, y: number) => (x + y) % 2 === 0,
  (_x: number, y: number) => y % 2 === 0,
  (x: number) => x % 3 === 0,
  (x: number, y: number) => (x + y) % 3 === 0,
  (x: number, y: number) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x: number, y: number) => ((x * y) % 2 + (x * y) % 3) === 0,
  (x: number, y: number) => (((x * y) % 2 + (x * y) % 3) % 2) === 0,
  (x: number, y: number) => (((x + y) % 2 + (x * y) % 3) % 2) === 0,
];

function createQrModules(value: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(value));
  const bits: number[] = [0, 1, 0, 0];
  pushBits(bits, bytes.length, 8);
  bytes.forEach((byte) => pushBits(bits, byte, 8));

  const capacity = QR_DATA_CODEWORDS * 8;
  if (bits.length > capacity) {
    throw new Error("QR value is too long for the configured code size.");
  }
  pushBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    dataCodewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let pad = 0xec; dataCodewords.length < QR_DATA_CODEWORDS; pad = pad === 0xec ? 0x11 : 0xec) {
    dataCodewords.push(pad);
  }

  const codewords = [...dataCodewords, ...reedSolomonRemainder(dataCodewords, QR_ECC_CODEWORDS)];
  const base = createBaseQrGrid();
  let best = placeQrData(base, codewords, 0);
  let bestPenalty = qrPenalty(best);

  for (let mask = 1; mask < QR_MASKS.length; mask += 1) {
    const candidate = placeQrData(base, codewords, mask);
    const penalty = qrPenalty(candidate);
    if (penalty < bestPenalty) {
      best = candidate;
      bestPenalty = penalty;
    }
  }

  return best.modules.map((row) => row.map(Boolean));
}

function pushBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function createBaseQrGrid() {
  const modules = Array.from({ length: QR_SIZE }, () => Array<boolean | null>(QR_SIZE).fill(null));
  const reserved = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false));

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) return;
    modules[y][x] = dark;
    reserved[y][x] = true;
  };

  drawFinder(setFunction, 0, 0);
  drawFinder(setFunction, QR_SIZE - 7, 0);
  drawFinder(setFunction, 0, QR_SIZE - 7);

  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    setFunction(i, 6, i % 2 === 0);
    setFunction(6, i, i % 2 === 0);
  }

  drawAlignment(setFunction, 26, 26);
  setFunction(8, QR_VERSION * 4 + 9, true);
  reserveFormatModules(setFunction);

  return { modules, reserved };
}

function drawFinder(setFunction: (x: number, y: number, dark: boolean) => void, left: number, top: number) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const inFinder = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const dark = inFinder && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      setFunction(left + x, top + y, dark);
    }
  }
}

function drawAlignment(setFunction: (x: number, y: number, dark: boolean) => void, cx: number, cy: number) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const distance = Math.max(Math.abs(x), Math.abs(y));
      setFunction(cx + x, cy + y, distance === 2 || distance === 0);
    }
  }
}

function reserveFormatModules(setFunction: (x: number, y: number, dark: boolean) => void) {
  for (let i = 0; i <= 5; i += 1) setFunction(8, i, false);
  setFunction(8, 7, false);
  setFunction(8, 8, false);
  setFunction(7, 8, false);
  for (let i = 0; i <= 5; i += 1) setFunction(i, 8, false);
  for (let i = 0; i < 8; i += 1) setFunction(QR_SIZE - 1 - i, 8, false);
  for (let i = 8; i < 15; i += 1) setFunction(8, QR_SIZE - 15 + i, false);
}

function placeQrData(
  base: { modules: Array<Array<boolean | null>>; reserved: boolean[][] },
  codewords: number[],
  mask: number,
) {
  const modules = base.modules.map((row) => [...row]);
  const reserved = base.reserved;
  const dataBits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, i) => (codeword >>> (7 - i)) & 1),
  );
  let bitIndex = 0;
  let upward = true;

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let offset = 0; offset < QR_SIZE; offset += 1) {
      const y = upward ? QR_SIZE - 1 - offset : offset;
      for (let col = 0; col < 2; col += 1) {
        const x = right - col;
        if (reserved[y][x]) continue;
        const raw = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
        modules[y][x] = raw !== QR_MASKS[mask](x, y);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }

  drawFormatBits(modules, mask);
  return { modules, reserved };
}

function drawFormatBits(modules: Array<Array<boolean | null>>, mask: number) {
  const bits = formatBits(mask);
  const set = (x: number, y: number, i: number) => {
    modules[y][x] = ((bits >>> i) & 1) === 1;
  };

  for (let i = 0; i <= 5; i += 1) set(8, i, i);
  set(8, 7, 6);
  set(8, 8, 7);
  set(7, 8, 8);
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, i);

  for (let i = 0; i < 8; i += 1) set(QR_SIZE - 1 - i, 8, i);
  for (let i = 8; i < 15; i += 1) set(8, QR_SIZE - 15 + i, i);
  modules[QR_VERSION * 4 + 9][8] = true;
}

function formatBits(mask: number) {
  const data = (1 << 3) | mask;
  let remainder = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (((remainder >>> i) & 1) !== 0) {
      remainder ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree);
  const result = Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    generator.slice(1).forEach((coefficient, i) => {
      result[i] ^= gfMultiply(coefficient, factor);
    });
  });
  return result;
}

function reedSolomonGenerator(degree: number) {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    result = polyMultiply(result, [1, gfPow(2, i)]);
  }
  return result;
}

function polyMultiply(left: number[], right: number[]) {
  const result = Array(left.length + right.length - 1).fill(0);
  left.forEach((a, i) => {
    right.forEach((b, j) => {
      result[i + j] ^= gfMultiply(a, b);
    });
  });
  return result;
}

function gfPow(value: number, power: number) {
  let result = 1;
  for (let i = 0; i < power; i += 1) result = gfMultiply(result, value);
  return result;
}

function gfMultiply(left: number, right: number) {
  let result = 0;
  for (let i = 0; i < 8; i += 1) {
    if ((right & 1) !== 0) result ^= left;
    const carry = (left & 0x80) !== 0;
    left = (left << 1) & 0xff;
    if (carry) left ^= 0x1d;
    right >>>= 1;
  }
  return result;
}

function qrPenalty(grid: { modules: Array<Array<boolean | null>> }) {
  const modules = grid.modules.map((row) => row.map(Boolean));
  let penalty = 0;

  for (let y = 0; y < QR_SIZE; y += 1) penalty += linePenalty(modules[y]);
  for (let x = 0; x < QR_SIZE; x += 1) penalty += linePenalty(modules.map((row) => row[x]));

  for (let y = 0; y < QR_SIZE - 1; y += 1) {
    for (let x = 0; x < QR_SIZE - 1; x += 1) {
      const color = modules[y][x];
      if (modules[y][x + 1] === color && modules[y + 1][x] === color && modules[y + 1][x + 1] === color) {
        penalty += 3;
      }
    }
  }

  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const inverse = pattern.map((v) => !v);
  for (let y = 0; y < QR_SIZE; y += 1) {
    for (let x = 0; x <= QR_SIZE - pattern.length; x += 1) {
      const segment = modules[y].slice(x, x + pattern.length);
      if (samePattern(segment, pattern) || samePattern(segment, inverse)) penalty += 40;
    }
  }
  for (let x = 0; x < QR_SIZE; x += 1) {
    for (let y = 0; y <= QR_SIZE - pattern.length; y += 1) {
      const segment = modules.slice(y, y + pattern.length).map((row) => row[x]);
      if (samePattern(segment, pattern) || samePattern(segment, inverse)) penalty += 40;
    }
  }

  const dark = modules.flat().filter(Boolean).length;
  const ratio = (dark * 100) / (QR_SIZE * QR_SIZE);
  penalty += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return penalty;
}

function linePenalty(line: boolean[]) {
  let penalty = 0;
  let runColor = line[0];
  let runLength = 1;
  for (let i = 1; i < line.length; i += 1) {
    if (line[i] === runColor) {
      runLength += 1;
    } else {
      if (runLength >= 5) penalty += 3 + runLength - 5;
      runColor = line[i];
      runLength = 1;
    }
  }
  return runLength >= 5 ? penalty + 3 + runLength - 5 : penalty;
}

function samePattern(left: boolean[], right: boolean[]) {
  return left.every((value, i) => value === right[i]);
}

function QrCode({ label, value }: { label: string; value: string }) {
  const modules = useMemo(() => createQrModules(value), [value]);
  const viewBox = `-4 -4 ${modules.length + 8} ${modules.length + 8}`;

  return (
    <svg
      role="img"
      aria-label={`${label} address QR code`}
      viewBox={viewBox}
      shapeRendering="crispEdges"
      className="h-24 w-24 shrink-0 rounded-md border border-border bg-white p-1"
    >
      <rect x={-4} y={-4} width={modules.length + 8} height={modules.length + 8} fill="#fff" />
      {modules.map((row, y) =>
        row.map((dark, x) => (
          dark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000" /> : null
        )),
      )}
    </svg>
  );
}

// ---------- Support button ----------
type SupportPaymentMethod = {
  label: string;
  initials: string;
  hint: string;
  href?: string;
  mobileHref?: string;
  copyValue?: string;
  accent: string;
};

const isLikelyMobile = () => {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
};

function SupportButton() {
  const [copied, setCopied] = useState<string | null>(null);
  const paymentMethods: SupportPaymentMethod[] = [
    { label: "PayPal", initials: "PP", hint: "open", href: "https://www.paypal.me/dlajr", mobileHref: "https://www.paypal.me/dlajr", accent: "linear-gradient(145deg, #003087, #009cde)" },
    { label: "Venmo", initials: "V", hint: "open", href: "https://venmo.com/u/imdanielaustin", mobileHref: "venmo://paycharge?txn=pay&recipients=imdanielaustin", accent: "linear-gradient(145deg, #008cff, #006aff)" },
    { label: "Cash App", initials: "$", hint: "open", href: "https://cash.app/$imdanielaustin", mobileHref: "https://cash.app/$imdanielaustin", accent: "linear-gradient(145deg, #00d632, #00a526)" },
    { label: "Coinbase", initials: "CB", hint: "open app", href: "https://www.coinbase.com/", mobileHref: "coinbase://", accent: "linear-gradient(145deg, #1652f0, #0a46e4)" },
  ];
  const addresses = [
    { label: "BTC", value: "bc1q5f6kzxspp44czej5rz044s4854awgvty6p0yfk" },
    { label: "ETH", value: "0x01DFD17138192C78a6C878f04fB3C1A7fF94FC60" },
    { label: "SOL", value: "DLxrbjPrSDRuo2a8B3P2RUALtSjdT3Cs6kLuWsCUrxzU" },
    { label: "PYUSD", value: "0xf9BF6a611F792207aB821eFF0E1E3e6db21660a5" },
  ];
  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard access can be denied by browser permissions.
    }
  };
  const activatePaymentMethod = async (method: SupportPaymentMethod) => {
    const target = isLikelyMobile() && method.mobileHref ? method.mobileHref : method.href;
    if (target) {
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    if (method.copyValue) {
      await copy(method.label, method.copyValue);
    }
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-pink-300/80 bg-pink-50 text-pink-700 shadow-sm shadow-pink-200/50 hover:border-pink-400 hover:bg-pink-100 hover:text-pink-800 dark:border-pink-400/40 dark:bg-pink-500/10 dark:text-pink-200 dark:shadow-none dark:hover:bg-pink-500/20"
        >
          <span>♡ Support</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="ae-support-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Support Development</DialogTitle>
          <DialogDescription className="max-w-prose text-sm leading-relaxed">
            Choose a payment app, or copy a crypto address. On mobile, supported buttons open the matching app when your device allows it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 pr-1" style={{ maxHeight: "min(62svh, 620px)", overflowY: "auto" }}>
          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Payment apps</p>
            <div className="ae-support-payment-grid">
              {paymentMethods.map((method) => {
                const enabled = !!method.href || !!method.copyValue;
                return (
                  <button
                    key={method.label}
                    type="button"
                    disabled={!enabled}
                    onClick={() => activatePaymentMethod(method)}
                    className="ae-support-payment-card"
                  >
                    <span className="ae-support-payment-icon" style={{ background: method.accent }}>
                      {method.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="ae-support-payment-label">{method.label}</span>
                      <span className="ae-support-payment-hint">
                        {enabled ? copied === method.label ? "copied" : "open" : method.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Crypto addresses</p>
            {addresses.map((a) => (
              <button key={a.label} onClick={() => copy(a.label, a.value)}
                className="w-full text-left flex items-center gap-3 border border-border px-3 py-3 hover:bg-muted transition-colors">
                <QrCode label={a.label} value={a.value} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{a.label}</p>
                  <p className="tabular text-xs break-all">{a.value}</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
                  {copied === a.label ? "copied ✓" : "copy"}
                </span>
              </button>
            ))}
          </section>
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
  hourlyWage: number; hourlyRequired: number; monthlyHours: number;
  income: number; gross: number; surplus: number; breakEvenHrs: number; ratio: number;
  status: Status; cryptoEquivalent: number;
  taxEnabled: boolean; taxRate: number;
};

function exportResultRows(d: ExportData) {
  const sign = d.surplus >= 0 ? "+" : "-";
  const rows = [
    { label: "Hourly Wage Required", value: fmtFiat(d.hourlyRequired, d.fiat) },
    { label: "Current Hourly Wage", value: fmtFiat(d.hourlyWage, d.fiat) },
    { label: "Monthly hours worked", value: `${d.monthlyHours.toFixed(0)} hrs` },
    { label: "Gross monthly income", value: fmtFiat(d.gross, d.fiat) },
  ];
  if (d.taxEnabled) {
    rows.push({ label: "Net take-home income", value: fmtFiat(d.income, d.fiat) });
  }
  rows.push(
    { label: "Monthly expenses", value: fmtFiat(d.expenses, d.fiat) },
    { label: "Surplus / deficit", value: `${sign}${fmtFiat(Math.abs(d.surplus), d.fiat)}` },
    { label: "Break-even hours / month", value: `${d.breakEvenHrs.toFixed(1)} hrs` },
    { label: "Income / expense ratio", value: `${d.ratio.toFixed(2)}x` },
  );
  if (d.crypto !== "NONE") {
    rows.push({
      label: `Income in ${d.crypto}`,
      value: `${d.cryptoEquivalent.toFixed(d.crypto === "USDC" ? 2 : 6)} ${d.crypto}`,
    });
  }
  return rows;
}

function exportSubtitle(d: ExportData) {
  const statusLabel = d.status === "sustainable" ? "Sustainable" : d.status === "thin" ? "Thin margin" : "Deficit";
  const sign = d.surplus >= 0 ? "surplus" : "deficit";
  return `${statusLabel} result with a ${fmtFiat(Math.abs(d.surplus), d.fiat)} monthly ${sign}. Generated ${new Date().toLocaleDateString()}.`;
}

async function buildPDF(d: ExportData): Promise<JsPDFDocument> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 64;
  let y = 76;
  const sign = d.surplus >= 0 ? "+" : "-";
  const statusLabel = d.status === "sustainable" ? "SUSTAINABLE" : d.status === "thin" ? "THIN MARGIN" : "DEFICIT";

  doc.setFillColor(250, 250, 249);
  doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(218, 218, 216);
  doc.setLineWidth(1);
  doc.roundedRect(M - 18, M - 18, W - M * 2 + 36, H - M * 2 + 36, 10, 10, "S");

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text("THE AUSTIN EQUATION", M, y);
  y += 30;
  doc.setFont("helvetica", "normal"); doc.setFontSize(30); doc.setTextColor(24);
  doc.text("Results Summary", M, y);
  y += 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(92);
  doc.text(doc.splitTextToSize(exportSubtitle(d), W - M * 2), M, y);
  y += 44;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, y, W - M * 2, 92, 8, 8, "F");
  doc.setDrawColor(224, 224, 222);
  doc.roundedRect(M, y, W - M * 2, 92, 8, 8, "S");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(112);
  doc.text("CURRENT RESULT", M + 18, y + 24);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(24);
  doc.text(statusLabel, M + 18, y + 56);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(`${sign}${fmtFiat(Math.abs(d.surplus), d.fiat)}`, W - M - 18, y + 54, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(112);
  doc.text("per month", W - M - 18, y + 70, { align: "right" });
  y += 126;

  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(96);
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(26);
    doc.text(value, W - M, y, { align: "right" });
    y += 18;
    doc.setDrawColor(230, 230, 228);
    doc.line(M, y - 8, W - M, y - 8);
    y += 8;
  };

  exportResultRows(d).forEach(({ label, value }) => row(label, value));

  doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(140);
  doc.text(`"Money is the measure of effort exchanged for time."`, M, H - 42);
  doc.text("M = E x T x C", W - M, H - 42, { align: "right" });

  return doc;
}

function downloadResultsImage(d: ExportData) {
  const scale = 2;
  const width = 1200;
  const height = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fafaf9";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#dededb";
  ctx.lineWidth = 2;
  roundRect(ctx, 78, 78, width - 156, height - 156, 20);
  ctx.stroke();

  let y = 150;
  ctx.fillStyle = "#6f6f6c";
  ctx.font = "700 18px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.fillText("THE AUSTIN EQUATION", 128, y);
  y += 72;
  ctx.fillStyle = "#181818";
  ctx.font = "52px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.fillText("Results Summary", 128, y);
  y += 42;
  ctx.fillStyle = "#5f5f5c";
  ctx.font = "24px Helvetica Neue, Helvetica, Arial, sans-serif";
  wrapCanvasText(ctx, exportSubtitle(d), 128, y, width - 256, 34);
  y += 112;

  const sign = d.surplus >= 0 ? "+" : "-";
  const statusLabel = d.status === "sustainable" ? "SUSTAINABLE" : d.status === "thin" ? "THIN MARGIN" : "DEFICIT";
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 128, y, width - 256, 170, 18);
  ctx.fill();
  ctx.strokeStyle = "#e2e2df";
  ctx.stroke();
  ctx.fillStyle = "#70706d";
  ctx.font = "700 18px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.fillText("CURRENT RESULT", 168, y + 48);
  ctx.fillStyle = "#181818";
  ctx.font = "44px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.fillText(statusLabel, 168, y + 108);
  ctx.font = "700 36px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${sign}${fmtFiat(Math.abs(d.surplus), d.fiat)}`, width - 168, y + 104);
  ctx.font = "20px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#70706d";
  ctx.fillText("per month", width - 168, y + 136);
  ctx.textAlign = "left";
  y += 240;

  exportResultRows(d).forEach(({ label, value }) => {
    ctx.fillStyle = "#666663";
    ctx.font = "24px Helvetica Neue, Helvetica, Arial, sans-serif";
    ctx.fillText(label, 128, y);
    ctx.fillStyle = "#191919";
    ctx.font = "700 25px Helvetica Neue, Helvetica, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(value, width - 128, y);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#e8e8e5";
    ctx.beginPath();
    ctx.moveTo(128, y + 22);
    ctx.lineTo(width - 128, y + 22);
    ctx.stroke();
    y += 58;
  });

  ctx.fillStyle = "#858581";
  ctx.font = "italic 22px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.fillText('"Money is the measure of effort exchanged for time."', 128, height - 128);
  ctx.font = "20px Helvetica Neue, Helvetica, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("M = E x T x C", width - 128, height - 128);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/jpeg", 0.94);
  link.download = `austin-equation-results-${new Date().toISOString().slice(0, 10)}.jpg`;
  link.click();
  toast.success("Image downloaded");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function PdfPreviewButton({ data }: { data: ExportData }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let blobUrl: string | null = null;
    setLoading(true);
    setUrl(null);
    buildPDF(data)
      .then((doc) => {
        if (!active) return;
        blobUrl = (doc.output("bloburl") as unknown as string).toString();
        setUrl(blobUrl);
      })
      .catch(() => {
        if (active) toast.error("PDF preview failed");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // The browser may already have released this object URL.
        }
      }
      setUrl(null);
    };
  }, [open, data]);

  const download = async () => {
    try {
      const doc = await buildPDF(data);
      doc.save(`austin-equation-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("PDF download failed");
    }
  };
  const downloadImage = () => downloadResultsImage(data);

  const print = async () => {
    try {
      const doc = await buildPDF(data);
      const blobUrl = (doc.output("bloburl") as unknown as string).toString();
      const w = window.open(blobUrl, "_blank");
      if (!w) {
        URL.revokeObjectURL(blobUrl);
        toast.error("Print window blocked");
        return;
      }
      w.addEventListener("load", () => {
        try {
          w.print();
        } catch {
          // Some browsers block programmatic print calls in new windows.
        }
      });
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      toast.error("PDF print failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span>Preview PDF</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] h-[88vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Results PDF Preview</DialogTitle>
          <DialogDescription>Preview, print, or download a clean summary of the Results section.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 border border-border bg-muted">
          {url ? (
            <iframe src={url} title="PDF preview" className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              {loading ? "Generating preview…" : "Preview unavailable"}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 pt-2 sm:justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="outline" onClick={print} disabled={loading}>
            <Printer className="h-4 w-4" /> Print PDF
          </Button>
          <Button onClick={download} disabled={loading}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button onClick={downloadImage}>
            <Download className="h-4 w-4" /> Download Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Share button ----------
function ShareButton({ state }: { state: typeof DEFAULTS }) {
  const share = async () => {
    const encoded = encodeShare(state);
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      // Fallback: prompt
      window.prompt("Copy your share link:", url);
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={share}
      className="gap-1.5"
      aria-label="Copy shareable link"
    >
      <Share2 className="h-4 w-4" />
      <span>Share</span>
    </Button>
  );
}

// ---------- Reset button ----------
function ResetButton({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5"
          aria-label="Reset all settings"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset all settings?</DialogTitle>
          <DialogDescription>
            This clears your inputs, tax configuration, and saved visualization slide. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { setOpen(false); onReset(); }}>Reset everything</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
