import {
  useEquation,
  EXPENSE_FIELDS,
  type FiatCode,
  type CryptoCode,
  type PayFreq,
  type TimeUnit,
  type TaxConfig,
  fmtFiat,
  FIAT_SYMBOL,
} from "@/lib/equation";
import { Switch } from "@/components/openui/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/openui/Select";
import {
  Home,
  ShoppingCart,
  Car,
  Shield,
  AlertCircle,
  PiggyBank,
  Music,
  Settings as SettingsIcon,
  CreditCard,
  ChevronDown,
  Zap,
} from "lucide-react";
import { Button } from "@/components/openui/Button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TAX_LOCATION,
  TAX_LOCATIONS,
  getTaxLocation,
  type TaxLocationCode,
} from "@/lib/taxLocations";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  "shopping-cart": ShoppingCart,
  car: Car,
  shield: Shield,
  "alert-circle": AlertCircle,
  "piggy-bank": PiggyBank,
  music: Music,
  zap: Zap,
};

const TAX_FIELDS: Array<{ key: keyof TaxConfig; label: string }> = [
  { key: "federal", label: "Federal" },
  { key: "state", label: "State" },
  { key: "fica", label: "FICA" },
  { key: "other", label: "Other" },
];

function shouldStartCollapsed() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

function NumberCell({
  value,
  onChange,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? String(value);
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-2 grid place-items-center text-[11px] text-muted-foreground">
          {prefix}
        </span>
      )}
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-[11px] text-muted-foreground">
          {suffix}
        </span>
      )}
      <input
        type="number"
        value={display}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = parseFloat(draft ?? "");
          onChange(Number.isFinite(v) ? v : 0);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        className={`h-7 w-20 rounded-md bg-input ${prefix ? "pl-5" : "pl-2"} ${suffix ? "pr-5" : "pr-2"} text-right text-xs tabular text-foreground sharp-edge focus:outline-none focus:ring-1 focus:ring-ring`}
      />
    </div>
  );
}

export function InputsPanel() {
  const { state, computed, set, setExpense, subscriptionSummary } = useEquation();
  const [inputsOpen, setInputsOpen] = useState(() => !shouldStartCollapsed());
  const [paycheckOpen, setPaycheckOpen] = useState(() => !shouldStartCollapsed());
  const [taxOpen, setTaxOpen] = useState(false);
  const sym = FIAT_SYMBOL[state.fiat];
  const setTax = (key: keyof TaxConfig, value: number) => {
    if (key === "state") set("taxLocation", DEFAULT_TAX_LOCATION);
    set("tax", { ...state.tax, [key]: Math.max(0, value) });
  };
  const setTaxLocation = (code: TaxLocationCode) => {
    const location = getTaxLocation(code);
    set("taxLocation", location.code);
    set("tax", { ...state.tax, state: location.rate });
  };

  return (
    <div className="rounded-xl bg-surface p-1 sharp-edge-card">
      {/* Header with monthly switcher */}
      <div className="flex items-center justify-between sharp-divider-b px-4 py-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Inputs
        </span>
        <div className="flex items-center gap-2">
          <Select value={state.timeUnit} onValueChange={(v) => set("timeUnit", v as TimeUnit)}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label={inputsOpen ? "Collapse inputs" : "Expand inputs"}
            aria-expanded={inputsOpen}
            aria-controls="inputs-expenses-section"
            onClick={() => setInputsOpen((open) => !open)}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", !inputsOpen && "-rotate-90")}
            />
          </button>
        </div>
      </div>

      {/* Expenses */}
      <div
        id="inputs-expenses-section"
        className={cn("px-4 py-4", !inputsOpen && "hidden lg:block")}
      >
        <div className="flex items-center justify-between pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Expenses
          </span>
          <span className="font-display text-base font-semibold tabular text-foreground">
            {fmtFiat(computed.expenses, state.fiat)}
          </span>
        </div>
        <ul className="space-y-2">
          {EXPENSE_FIELDS.map((f) => {
            const Icon = ICONS[f.icon] ?? Home;
            return (
              <li
                key={f.key}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/40"
              >
                <span className="flex items-center gap-2 text-xs">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {f.label}
                </span>
                <NumberCell
                  value={state.expenseItems[f.key]}
                  onChange={(v) => setExpense(f.key, v)}
                  prefix={sym}
                />
              </li>
            );
          })}
          {subscriptionSummary.monthlyTotal > 0 && (
            <li className="flex items-center justify-between gap-2 rounded-md bg-muted/25 px-2 py-2">
              <span className="flex items-center gap-2 text-xs">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Subscriptions
              </span>
              <span className="text-xs font-semibold tabular text-foreground">
                {fmtFiat(subscriptionSummary.monthlyTotal, state.fiat)}
              </span>
            </li>
          )}
        </ul>
      </div>

      <div className="sharp-divider-t">
        <div className="flex items-center justify-between sharp-divider-b px-4 py-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Paycheck
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={state.taxLocation}
              onValueChange={(v) => setTaxLocation(v as TaxLocationCode)}
            >
              <SelectTrigger className="h-7 w-36 text-xs sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72 w-64">
                {TAX_LOCATIONS.map((location) => (
                  <SelectItem key={location.code} value={location.code}>
                    {location.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              aria-label={paycheckOpen ? "Collapse paycheck" : "Expand paycheck"}
              aria-expanded={paycheckOpen}
              aria-controls="inputs-paycheck-section"
              onClick={() => setPaycheckOpen((open) => !open)}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", !paycheckOpen && "-rotate-90")}
              />
            </button>
          </div>
        </div>

        <div
          id="inputs-paycheck-section"
          className={cn("px-4 py-4", !paycheckOpen && "hidden lg:block")}
        >
          <div className="space-y-2.5">
            <Field label="Wage / Pay">
              <div className="flex items-center gap-1.5">
                <NumberCell
                  value={state.wageAmount}
                  onChange={(v) => set("wageAmount", v)}
                  prefix={sym}
                />
                <span className="text-[11px] text-muted-foreground">/ {state.payFreq}</span>
              </div>
            </Field>
            <Field label="Pay Frequency">
              <Select value={state.payFreq} onValueChange={(v) => set("payFreq", v as PayFreq)}>
                <SelectTrigger className="h-7 w-28 text-xs capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["hourly", "daily", "weekly", "biweekly", "monthly"] as PayFreq[]).map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {titleCase(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Work Hours / ${titleCase(state.timeUnit)} (T)`}>
              <div className="flex items-center gap-1.5">
                <NumberCell value={state.hoursPerUnit} onChange={(v) => set("hoursPerUnit", v)} />
                <span className="text-[11px] text-muted-foreground">hrs</span>
              </div>
            </Field>
            <Field label="Effort Multiplier (E)">
              <Select
                value={String(state.effort)}
                onValueChange={(v) => set("effort", parseFloat(v))}
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((e) => (
                    <SelectItem key={e} value={String(e)}>
                      {e}×
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Currency">
              <Select value={state.fiat} onValueChange={(v) => set("fiat", v as FiatCode)}>
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["USD", "EUR", "GBP", "JPY", "CAD"] as FiatCode[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Crypto Denom.">
              <Select value={state.crypto} onValueChange={(v) => set("crypto", v as CryptoCode)}>
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["NONE", "BTC", "ETH", "SOL", "USDC"] as CryptoCode[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={state.taxEnabled} onCheckedChange={(v) => set("taxEnabled", v)} />
              <span>
                Apply Estimated Taxes{" "}
                {state.taxEnabled && (
                  <span className="text-muted-foreground">
                    ({(computed.taxRate * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            aria-expanded={taxOpen}
            onClick={() => setTaxOpen((open) => !open)}
          >
            <SettingsIcon className="h-3.5 w-3.5" /> Configure Tax
          </Button>
          {taxOpen && (
            <div className="mt-3 space-y-2 rounded-md bg-surface-2/40 p-3 sharp-edge">
              {TAX_FIELDS.map((field) => (
                <Field key={field.key} label={field.label}>
                  <NumberCell
                    value={state.tax[field.key]}
                    onChange={(v) => setTax(field.key, v)}
                    suffix="%"
                  />
                </Field>
              ))}
              <div className="flex items-center justify-between sharp-divider-t pt-2 text-[11px]">
                <span className="uppercase tracking-[0.14em] text-muted-foreground">
                  Total Estimate
                </span>
                <span className="font-semibold tabular text-foreground">
                  {(computed.taxRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
