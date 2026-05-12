import { lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  useEquation,
  fmtFiat,
  fmtRatio,
  STATUS_META,
  EXPENSE_FIELDS,
  FIAT_SYMBOL,
  type EquationState,
  type ExpenseItems,
} from "@/lib/equation";
import { InputsPanel } from "@/components/InputsPanel";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { Button } from "@/components/openui/Button";
import { Input } from "@/components/openui/Input";
import { Database, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SparkChart = lazy(() =>
  import("@/components/DashboardCharts").then((module) => ({ default: module.SparkChart })),
);
const IncomeExpensesChart = lazy(() =>
  import("@/components/DashboardCharts").then((module) => ({
    default: module.IncomeExpensesChart,
  })),
);
const TimeAllocationChart = lazy(() =>
  import("@/components/DashboardCharts").then((module) => ({
    default: module.TimeAllocationChart,
  })),
);
const BankTransactionsWidget = lazy(() =>
  import("@/components/BankTransactionsWidget").then((module) => ({
    default: module.BankTransactionsWidget,
  })),
);
const NetWorthOverTime = lazy(() =>
  import("@/components/NetWorthOverTime").then((module) => ({ default: module.NetWorthOverTime })),
);
const NetWorthBreakdown = lazy(() =>
  import("@/components/NetWorthBreakdown").then((module) => ({
    default: module.NetWorthBreakdown,
  })),
);
const InvestmentMarketChart = lazy(() =>
  import("@/components/InvestmentMarketChart").then((module) => ({
    default: module.InvestmentMarketChart,
  })),
);

const KPI_ORDER_KEY = "fyi:dashboard-kpi-order:v1";
const DEFAULT_KPI_ORDER = [
  "effectiveWage",
  "netIncome",
  "financialOverview",
  "incomeRatio",
  "breakEven",
] as const;
type KpiId = (typeof DEFAULT_KPI_ORDER)[number];

export default function Dashboard() {
  const { activeProfile } = useEquation();
  if (activeProfile.dashboardType === "investments") return <InvestmentDashboard />;
  return <PersonalDashboard />;
}

function PersonalDashboard() {
  const { state, computed, set, activeProfile } = useEquation();
  const isBusinessDashboard = activeProfile.dashboardType === "business";
  const [chartRange, setChartRange] = useState<ChartRange>("6M");
  const [kpiOrder, setKpiOrder] = useState<KpiId[]>(() => loadKpiOrder());
  const [activeKpi, setActiveKpi] = useState<KpiId | null>(null);
  const holdTimer = useRef<number | null>(null);
  const activeKpiRef = useRef<KpiId | null>(null);
  const status = STATUS_META[computed.status];
  const sym = FIAT_SYMBOL[state.fiat];
  const sparkData = computed.series.map((d) => ({ x: d.month, y: d.income }));
  const ratioSparkData = computed.series.map((d) => ({
    x: d.month,
    y: d.income / Math.max(d.expenses, 1),
  }));
  const wageSpark = computed.series.map((d) => ({
    x: d.month,
    y: computed.netHourlyWage * (1 + Math.sin(d.month.length) * 0.04),
  }));
  const breakEven = computed.expenses;
  const chartData = useMemo(
    () => buildLiveSeries(computed.income, computed.expenses, chartRange),
    [computed.income, computed.expenses, chartRange],
  );
  const timeAlloc = buildTimeAllocation(state);
  const visibleKpiOrder = isBusinessDashboard
    ? kpiOrder.filter((id) => id !== "effectiveWage" && id !== "breakEven")
    : kpiOrder;
  const setExpenseTotal = (value: number) => {
    set(
      "expenseItems",
      scaleExpenseItems(state.expenseItems, Math.max(0, value - computed.subscriptionExpenses)),
    );
  };
  const kpiCards = useMemo<Record<KpiId, React.ReactNode>>(
    () => ({
      effectiveWage: (
        <KpiCard
          title="Effective Hourly Wage"
          value={fmtFiat(computed.netHourlyWage, state.fiat)}
          tone={computed.netHourlyWage >= computed.hourlyWage * 0.65 ? "good" : "warning"}
          chip={
            <span className="text-[11px] text-muted-foreground">
              Pre-tax: {fmtFiat(computed.hourlyWage, state.fiat)}
            </span>
          }
          spark={
            <DeferredChart className="h-10">
              <SparkChart data={wageSpark} positive />
            </DeferredChart>
          }
        />
      ),
      netIncome: (
        <KpiCard
          title="Net Take-Home Income"
          value={fmtFiat(computed.income, state.fiat)}
          tone="good"
          chip={<DeltaChip value="+18.0%" positive />}
          spark={
            <DeferredChart className="h-10">
              <SparkChart data={sparkData} positive />
            </DeferredChart>
          }
        />
      ),
      financialOverview: (
        <KpiCard
          title="Financial Overview"
          value={fmtFiat(computed.surplus, state.fiat, { compact: true })}
          tone={computed.surplus >= 0 ? "good" : "danger"}
          valueClass={status.color}
          footer={
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Surplus / Deficit
              </span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium sharp-edge",
                  status.chip,
                )}
              >
                {status.label}
              </span>
            </div>
          }
          sub={`Last updated: ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
        />
      ),
      incomeRatio: (
        <KpiCard
          title="Income / Expense Ratio"
          value={fmtRatio(computed.ratio)}
          tone={computed.ratio >= 1.2 ? "good" : computed.ratio >= 1 ? "warning" : "danger"}
          chip={
            <span className="text-[11px] text-[color:var(--warning)]">
              {computed.ratio < 1.2 ? "Below 1.2×" : "On target"}
            </span>
          }
          spark={
            <DeferredChart className="h-10">
              <SparkChart data={ratioSparkData} positive={computed.ratio >= 1} />
            </DeferredChart>
          }
        />
      ),
      breakEven: (
        <KpiCard
          title="Break-Even Hours / mo."
          value={`${computed.breakEvenHrs.toFixed(1)} hrs`}
          tone={computed.breakEvenHrs <= computed.monthlyHours ? "good" : "warning"}
          chip={
            <span className="text-[11px] text-muted-foreground">
              {Math.max(0, computed.breakEvenHrs - computed.monthlyHours).toFixed(1)} more hrs
              needed
            </span>
          }
          spark={<MiniBar value={computed.monthlyHours} target={computed.breakEvenHrs} />}
        />
      ),
    }),
    [computed, ratioSparkData, sparkData, state.fiat, status, wageSpark],
  );

  const reorderKpi = (source: KpiId, target: KpiId) => {
    if (source === target) return;
    setKpiOrder((current) => {
      const next = [...current];
      const from = next.indexOf(source);
      const to = next.indexOf(target);
      if (from < 0 || to < 0) return current;
      next.splice(from, 1);
      next.splice(to, 0, source);
      try {
        localStorage.setItem(KPI_ORDER_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const clearHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const endKpiHold = () => {
    clearHold();
    activeKpiRef.current = null;
    setActiveKpi(null);
  };

  const startKpiHold = (id: KpiId, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearHold();
    holdTimer.current = window.setTimeout(() => {
      activeKpiRef.current = id;
      setActiveKpi(id);
    }, 220);
  };

  const moveKpiHold = (event: PointerEvent<HTMLDivElement>) => {
    const source = activeKpiRef.current;
    if (!source) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-dashboard-kpi-id]")?.dataset.dashboardKpiId as
      | KpiId
      | undefined;
    if (target && DEFAULT_KPI_ORDER.includes(target)) reorderKpi(source, target);
  };
  const keySummaryCard = (
    <Card>
      <CardHeader>
        <CardTitle>Key Summary</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          <Stat label="Monthly Hours Worked" value={`${computed.monthlyHours.toFixed(0)} hrs`} />
          <Stat label="Gross Monthly Income" value={fmtFiat(computed.gross, state.fiat)} />
          <Stat label="Net Take-Home Income" value={fmtFiat(computed.income, state.fiat)} />
          <Stat
            label={computed.surplus >= 0 ? "Net Surplus" : "Net Deficit"}
            value={fmtFiat(computed.surplus, state.fiat)}
            valueClass={status.color}
          />
          <Stat label="Income / Expense" value={fmtRatio(computed.ratio)} />
          <Stat label="Break-Even Hrs / mo." value={`${computed.breakEvenHrs.toFixed(1)} hrs`} />
        </dl>
      </CardBody>
    </Card>
  );

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 p-4 md:p-6",
        !isBusinessDashboard && "lg:grid-cols-[300px_minmax(0,1fr)]",
      )}
    >
      {/* Left inputs */}
      {!isBusinessDashboard && (
        <div>
          <InputsPanel />
        </div>
      )}

      {/* Dashboard content */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        {isBusinessDashboard && <div className="xl:col-span-2">{keySummaryCard}</div>}

        {/* KPI Row */}
        <div className="grid min-w-0 grid-cols-1 gap-4">
          {visibleKpiOrder.map((id) => (
            <div
              key={id}
              data-dashboard-kpi-id={id}
              onPointerDown={(event) => startKpiHold(id, event)}
              onPointerMove={moveKpiHold}
              onPointerUp={endKpiHold}
              onPointerCancel={endKpiHold}
              className={cn(
                "select-none rounded-xl transition-transform md:cursor-grab",
                activeKpi === id &&
                  "scale-[0.99] cursor-grabbing opacity-80 ring-2 ring-primary/60",
                activeKpi && activeKpi !== id && "cursor-grabbing",
              )}
              title="Tap and hold to reposition"
            >
              {kpiCards[id]}
            </div>
          ))}
        </div>

        {/* Right column: time allocation and transaction health */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Time Allocation (Weekly)</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="relative h-40">
                <DeferredChart className="h-40">
                  <TimeAllocationChart data={timeAlloc} />
                </DeferredChart>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="font-display text-xl font-semibold tabular">168</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Total hrs
                    </div>
                  </div>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-[11px]">
                {timeAlloc.map((d) => (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {formatHours(d.value)} hrs ({Math.round((d.value / 168) * 100)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {!isBusinessDashboard && (
            <Card>
              <CardHeader>
                <CardTitle>Time Remaining After Expenses</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="font-display text-2xl font-semibold tabular">
                  {(168 - computed.breakEvenHrs / 4.33).toFixed(1)}{" "}
                  <span className="text-base text-muted-foreground">hrs / week</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  After covering monthly expenses
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((168 - computed.breakEvenHrs / 4.33) / 168) * 100))}%`,
                    }}
                  />
                </div>
              </CardBody>
            </Card>
          )}

          <Suspense fallback={<ChartSkeleton className="h-48" />}>
            <NetWorthBreakdown />
          </Suspense>

          <Suspense fallback={<ChartSkeleton className="h-48" />}>
            <BankTransactionsWidget limit={4} compact />
          </Suspense>
        </div>

        {/* Income vs Expenses chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <CardTitle className="shrink-0">Income vs Expenses</CardTitle>
            <div className="grid grid-cols-4 gap-1 text-[11px] min-[420px]:grid-cols-7 sm:flex sm:flex-wrap sm:justify-end">
              {CHART_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setChartRange(r)}
                  className={cn(
                    "min-h-7 rounded-md px-2 py-1 text-center tabular text-muted-foreground hover:bg-muted hover:text-foreground",
                    r === chartRange && "bg-muted text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody>
            <div className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
              <Legend
                dot="var(--success)"
                label="Income"
                value={fmtFiat(computed.income, state.fiat)}
              />
              <Legend
                dot="var(--destructive)"
                label="Expenses"
                value={fmtFiat(computed.expenses, state.fiat)}
              />
              <Legend
                dot={status.color.includes("destructive") ? "var(--destructive)" : "var(--warning)"}
                label={computed.surplus >= 0 ? "Surplus" : "Deficit"}
                value={fmtFiat(Math.abs(computed.surplus), state.fiat)}
              />
            </div>
            <div className="mb-4 grid gap-3 rounded-lg bg-surface-2/40 p-3 sharp-edge md:grid-cols-2">
              <LiveMoneyControl
                label="Income driver"
                caption={`Wage / ${state.payFreq}`}
                value={state.wageAmount}
                max={Math.max(500, state.wageAmount * 2, 10000)}
                prefix={sym}
                onChange={(value) => set("wageAmount", value)}
              />
              <LiveMoneyControl
                label="Expense total"
                caption={
                  computed.subscriptionExpenses > 0
                    ? `Monthly spend incl. ${fmtFiat(computed.subscriptionExpenses, state.fiat)} subscriptions`
                    : "Monthly spend"
                }
                value={computed.expenses}
                max={Math.max(500, computed.expenses * 2, 20000)}
                prefix={sym}
                onChange={setExpenseTotal}
              />
            </div>
            <div className="h-72">
              <DeferredChart className="h-72">
                <IncomeExpensesChart data={chartData} fiat={state.fiat} breakEven={breakEven} />
              </DeferredChart>
            </div>
          </CardBody>
        </Card>

        {/* Net worth */}
        <div className="xl:col-span-2">
          <Suspense fallback={<ChartSkeleton className="h-72" />}>
            <NetWorthOverTime />
          </Suspense>
        </div>

        {/* Key summary row */}
        {!isBusinessDashboard && <div className="xl:col-span-2">{keySummaryCard}</div>}
      </div>
    </div>
  );
}

type MarketPoint = { time: string; value: number };
type MarketQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  points: MarketPoint[];
  source: "Yahoo Finance" | "Local Fallback";
  status: "live" | "fallback";
};
type InvestmentWatchlist = { id: string; name: string; icon: string; symbols: string[] };

const DEFAULT_MARKET_SYMBOLS = ["^GSPC", "^IXIC", "AAPL", "MSFT", "NVDA"];
const DEFAULT_WATCHLISTS: InvestmentWatchlist[] = [
  { id: "core-market", name: "Core Market", icon: "📈", symbols: ["^GSPC", "^IXIC", "AAPL"] },
  { id: "ai-growth", name: "AI Growth", icon: "✨", symbols: ["NVDA", "MSFT", "GOOGL"] },
];
const WATCHLISTS_KEY = "fyi:investment-watchlists:v1";

function InvestmentDashboard() {
  const { activeProfile } = useEquation();
  const [watchlists, setWatchlists] = useState<InvestmentWatchlist[]>(() =>
    loadInvestmentWatchlists(activeProfile.id),
  );
  const [activeWatchlistId, setActiveWatchlistId] = useState(watchlists[0]?.id || "");
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [newWatchlistIcon, setNewWatchlistIcon] = useState("⭐");
  const [symbolDraft, setSymbolDraft] = useState("");
  const [quotes, setQuotes] = useState<MarketQuote[]>(() =>
    DEFAULT_MARKET_SYMBOLS.map((symbol, index) => fallbackQuote(symbol, index)),
  );
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const saved = loadInvestmentWatchlists(activeProfile.id);
    setWatchlists(saved);
    setActiveWatchlistId(saved[0]?.id || "");
  }, [activeProfile.id]);

  useEffect(() => {
    saveInvestmentWatchlists(activeProfile.id, watchlists);
  }, [activeProfile.id, watchlists]);

  const activeWatchlist =
    watchlists.find((watchlist) => watchlist.id === activeWatchlistId) || watchlists[0];
  const marketSymbols = Array.from(
    new Set([...DEFAULT_MARKET_SYMBOLS, ...(activeWatchlist?.symbols || [])]),
  );
  const marketSymbolsKey = marketSymbols.join("|");

  const refreshMarket = async () => {
    setLoading(true);
    try {
      const next = await loadMarketQuotes(marketSymbols);
      setQuotes(next);
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketSymbolsKey]);

  const primaryQuote = quotes[0] || fallbackQuote("^GSPC", 0);
  const displayedQuotes = quotes.filter((quote) => marketSymbols.includes(quote.symbol));
  const dataSource = quotes.some((quote) => quote.status === "live")
    ? "Yahoo Finance"
    : "Local Fallback";

  const addWatchlist = () => {
    const name = newWatchlistName.trim();
    if (!name) return;
    const next: InvestmentWatchlist = {
      id: `watch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      icon: newWatchlistIcon.trim().slice(0, 4) || "⭐",
      symbols: [],
    };
    setWatchlists((current) => [...current, next]);
    setActiveWatchlistId(next.id);
    setNewWatchlistName("");
    setNewWatchlistIcon("⭐");
  };

  const addSymbol = () => {
    const symbol = symbolDraft.trim().toUpperCase();
    if (!symbol || !activeWatchlist) return;
    setWatchlists((current) =>
      current.map((watchlist) =>
        watchlist.id === activeWatchlist.id && !watchlist.symbols.includes(symbol)
          ? { ...watchlist, symbols: [...watchlist.symbols, symbol] }
          : watchlist,
      ),
    );
    setSymbolDraft("");
  };

  const removeSymbol = (symbol: string) => {
    if (!activeWatchlist) return;
    setWatchlists((current) =>
      current.map((watchlist) =>
        watchlist.id === activeWatchlist.id
          ? { ...watchlist, symbols: watchlist.symbols.filter((item) => item !== symbol) }
          : watchlist,
      ),
    );
  };

  const deleteWatchlist = (id: string) => {
    setWatchlists((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((watchlist) => watchlist.id !== id);
      if (id === activeWatchlistId) setActiveWatchlistId(next[0]?.id || "");
      return next;
    });
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Investments Dashboard
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live market view, data source visibility, and customizable watchlists.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshMarket}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          {loading ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      <Card className="surface-elevated">
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Live Stock Market</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {primaryQuote.name} · {primaryQuote.symbol}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium sharp-edge",
              dataSource === "Yahoo Finance"
                ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {dataSource}
          </span>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-h-80">
              <Suspense fallback={<ChartSkeleton className="h-80" />}>
                <InvestmentMarketChart data={primaryQuote.points} />
              </Suspense>
            </div>
            <div className="grid gap-3 content-start">
              <MarketStat quote={primaryQuote} featured />
              {displayedQuotes.slice(1, 5).map((quote) => (
                <MarketStat key={quote.symbol} quote={quote} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Watchlists</CardTitle>
            <span className="text-[11px] text-muted-foreground">
              {watchlists.length} List{watchlists.length === 1 ? "" : "s"}
            </span>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {watchlists.map((watchlist) => (
                <button
                  key={watchlist.id}
                  type="button"
                  onClick={() => setActiveWatchlistId(watchlist.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium sharp-edge",
                    watchlist.id === activeWatchlist?.id
                      ? "bg-primary/15 text-primary"
                      : "bg-surface-2/45 text-foreground hover:bg-muted",
                  )}
                >
                  <span>{watchlist.icon}</span>
                  <span>{watchlist.name}</span>
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-surface-2/35 p-3 sharp-edge">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {activeWatchlist?.icon} {activeWatchlist?.name || "Watchlist"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Symbols In This List</div>
                </div>
                {activeWatchlist && watchlists.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteWatchlist(activeWatchlist.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={symbolDraft}
                  onChange={(event) => setSymbolDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addSymbol();
                  }}
                  placeholder="AAPL"
                  className="uppercase"
                />
                <Button type="button" size="sm" onClick={addSymbol}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(activeWatchlist?.symbols.length ? activeWatchlist.symbols : ["Add A Symbol"]).map(
                  (symbol) =>
                    symbol === "Add A Symbol" ? (
                      <div
                        key={symbol}
                        className="rounded-md bg-muted/35 px-3 py-2 text-xs text-muted-foreground sharp-edge"
                      >
                        Add A Symbol To Start This Watchlist.
                      </div>
                    ) : (
                      <div
                        key={symbol}
                        className="flex items-center justify-between gap-2 rounded-md bg-muted/35 px-3 py-2 sharp-edge"
                      >
                        <span className="text-xs font-semibold text-foreground">{symbol}</span>
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => removeSymbol(symbol)}
                        >
                          Remove
                        </button>
                      </div>
                    ),
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>New Watchlist</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                <span>Custom Name</span>
                <Input
                  value={newWatchlistName}
                  onChange={(event) => setNewWatchlistName(event.target.value)}
                  placeholder="Long-Term Growth"
                />
              </label>
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                <span>Icon Or Emoji</span>
                <Input
                  value={newWatchlistIcon}
                  onChange={(event) => setNewWatchlistIcon(event.target.value)}
                  maxLength={4}
                  placeholder="🚀"
                />
              </label>
              <Button type="button" className="w-full" onClick={addWatchlist}>
                <Plus className="h-3.5 w-3.5" /> Create Watchlist
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Source</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardBody className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                Primary Market Data Comes From The Yahoo Finance Chart Endpoint For Intraday Prices.
              </p>
              <p>
                If The Browser Cannot Reach Yahoo Finance, FYI Uses Local Fallback Data So The
                Investment Dashboard Still Loads Offline.
              </p>
              <div className="rounded-lg bg-surface-2/40 p-3 sharp-edge">
                <div className="font-semibold text-foreground">Current Source</div>
                <div className="mt-1">{dataSource}</div>
                <div className="mt-1">
                  Last Updated:{" "}
                  {updatedAt
                    ? updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                    : "Pending"}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MarketStat({ quote, featured }: { quote: MarketQuote; featured?: boolean }) {
  const positive = quote.change >= 0;
  return (
    <div className={cn("rounded-lg bg-surface-2/40 p-3 sharp-edge", featured && "bg-primary/10")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{quote.name}</div>
          <div className="text-[11px] text-muted-foreground">{quote.symbol}</div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium sharp-edge",
            quote.status === "live"
              ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
              : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
          )}
        >
          {quote.status === "live" ? "Live" : "Fallback"}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-display text-xl font-semibold tabular text-foreground">
          ${quote.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium tabular",
            positive ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]",
          )}
        >
          {positive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {positive ? "+" : ""}
          {quote.changePct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

async function loadMarketQuotes(symbols: string[]) {
  const unique = Array.from(
    new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)),
  );
  const settled = await Promise.all(
    unique.map(async (symbol, index) => {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`,
        );
        if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status}`);
        const payload = await response.json();
        return parseYahooQuote(symbol, payload) || fallbackQuote(symbol, index);
      } catch {
        return fallbackQuote(symbol, index);
      }
    }),
  );
  return settled.length
    ? settled
    : DEFAULT_MARKET_SYMBOLS.map((symbol, index) => fallbackQuote(symbol, index));
}

function parseYahooQuote(symbol: string, payload: unknown): MarketQuote | null {
  const result = (
    payload as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            shortName?: string;
            longName?: string;
            symbol?: string;
          };
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    }
  )?.chart?.result?.[0];
  if (!result?.meta || !result.timestamp?.length) return null;
  const closes = result.indicators?.quote?.[0]?.close || [];
  const points = result.timestamp
    .map((timestamp, index) => ({
      time: new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      value: Number(closes[index]),
    }))
    .filter((point) => Number.isFinite(point.value));
  if (!points.length) return null;
  const price = Number(result.meta.regularMarketPrice || points[points.length - 1].value);
  const previous = Number(
    result.meta.chartPreviousClose || result.meta.previousClose || points[0].value,
  );
  const change = price - previous;
  const changePct = previous ? (change / previous) * 100 : 0;
  return {
    symbol: result.meta.symbol || symbol,
    name: result.meta.shortName || result.meta.longName || friendlySymbol(symbol),
    price,
    change,
    changePct,
    points,
    source: "Yahoo Finance",
    status: "live",
  };
}

function fallbackQuote(symbol: string, index: number): MarketQuote {
  const base = fallbackBase(symbol, index);
  const points = Array.from({ length: 18 }, (_, pointIndex) => {
    const wave = Math.sin((pointIndex / 17) * Math.PI * 2 + index * 0.75);
    const drift = pointIndex * (base * 0.0009);
    return {
      time: `${pointIndex + 7}:00`,
      value: Math.max(1, base + wave * base * 0.012 + drift),
    };
  });
  const price = points[points.length - 1].value;
  const previous = points[0].value;
  const change = price - previous;
  return {
    symbol,
    name: friendlySymbol(symbol),
    price,
    change,
    changePct: (change / previous) * 100,
    points,
    source: "Local Fallback",
    status: "fallback",
  };
}

function fallbackBase(symbol: string, index: number) {
  const known: Record<string, number> = {
    "^GSPC": 5250,
    "^IXIC": 16500,
    AAPL: 190,
    MSFT: 430,
    NVDA: 890,
    GOOGL: 170,
  };
  return known[symbol] || 75 + index * 38;
}

function friendlySymbol(symbol: string) {
  const names: Record<string, string> = {
    "^GSPC": "S&P 500",
    "^IXIC": "Nasdaq Composite",
    AAPL: "Apple",
    MSFT: "Microsoft",
    NVDA: "NVIDIA",
    GOOGL: "Alphabet",
  };
  return names[symbol] || symbol;
}

function loadInvestmentWatchlists(profileId: string): InvestmentWatchlist[] {
  if (typeof window === "undefined") return DEFAULT_WATCHLISTS;
  try {
    const parsed = JSON.parse(localStorage.getItem(`${WATCHLISTS_KEY}:${profileId}`) || "null");
    if (!Array.isArray(parsed)) return DEFAULT_WATCHLISTS;
    const sanitized = parsed
      .map((item): InvestmentWatchlist | null => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Partial<InvestmentWatchlist>;
        return {
          id:
            typeof raw.id === "string" ? raw.id : `watch-${Math.random().toString(36).slice(2, 8)}`,
          name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Watchlist",
          icon: typeof raw.icon === "string" && raw.icon.trim() ? raw.icon.slice(0, 4) : "⭐",
          symbols: Array.isArray(raw.symbols)
            ? raw.symbols
                .filter((symbol): symbol is string => typeof symbol === "string")
                .map((symbol) => symbol.trim().toUpperCase())
                .filter(Boolean)
            : [],
        };
      })
      .filter(Boolean) as InvestmentWatchlist[];
    return sanitized.length ? sanitized : DEFAULT_WATCHLISTS;
  } catch {
    return DEFAULT_WATCHLISTS;
  }
}

function saveInvestmentWatchlists(profileId: string, watchlists: InvestmentWatchlist[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${WATCHLISTS_KEY}:${profileId}`, JSON.stringify(watchlists));
  } catch {
    /* ignore */
  }
}

function KpiCard({
  title,
  value,
  valueClass,
  chip,
  spark,
  footer,
  sub,
  className,
  tone = "neutral",
}: {
  title: string;
  value: string;
  valueClass?: string;
  chip?: React.ReactNode;
  spark?: React.ReactNode;
  footer?: React.ReactNode;
  sub?: string;
  className?: string;
  tone?: "good" | "warning" | "danger" | "neutral";
}) {
  const toneClass = {
    good: "bg-[color:var(--success)]",
    warning: "bg-[color:var(--warning)]",
    danger: "bg-[color:var(--destructive)]",
    neutral: "bg-primary",
  }[tone];
  return (
    <Card className={cn("surface-elevated", className)}>
      <CardHeader className="items-start">
        <CardTitle>{title}</CardTitle>
        {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
      </CardHeader>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div
            className={cn(
              "font-display text-[2.4rem] font-bold tabular leading-none tracking-normal sm:text-[2.75rem]",
              valueClass,
            )}
          >
            {value}
          </div>
          <span
            className={cn(
              "mt-2 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_16px_currentColor]",
              toneClass,
            )}
          />
        </div>
        {chip && <div className="mt-3">{chip}</div>}
        {spark && <div className="mt-4 h-10">{spark}</div>}
        {footer}
      </CardBody>
    </Card>
  );
}

function DeltaChip({ value, positive }: { value: string; positive?: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium",
        positive ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]",
      )}
    >
      <Icon className="h-3 w-3" /> {value}{" "}
      <span className="text-muted-foreground font-normal">vs last month</span>
    </span>
  );
}

function DeferredChart({ children, className }: { children: React.ReactNode; className: string }) {
  return <Suspense fallback={<ChartSkeleton className={className} />}>{children}</Suspense>;
}

function ChartSkeleton({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2/40 sharp-edge", className)} />;
}

function MiniBar({ value, target }: { value: number; target: number }) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(target, 1)) * 100));
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] tabular text-muted-foreground">
        <span>0</span>
        <span>{value.toFixed(0)}</span>
        <span>{target.toFixed(0)}</span>
      </div>
    </div>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <span className="min-w-0 rounded-md bg-surface-2/30 px-2.5 py-2 sharp-edge">
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: dot }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="block truncate font-display text-sm font-semibold tabular text-foreground sm:text-base">
        {value}
      </span>
    </span>
  );
}

function LiveMoneyControl({
  label,
  caption,
  value,
  max,
  prefix,
  onChange,
}: {
  label: string;
  caption: string;
  value: number;
  max: number;
  prefix: string;
  onChange: (value: number) => void;
}) {
  const rounded = Math.round(value);
  const update = (next: string) => {
    const parsed = Number(next);
    onChange(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
  };

  return (
    <label className="grid gap-2">
      <span className="grid gap-2 min-[430px]:grid-cols-[minmax(0,1fr)_auto] min-[430px]:items-center">
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{caption}</span>
        </span>
        <span className="relative min-w-0">
          <span className="pointer-events-none absolute inset-y-0 left-2 grid place-items-center text-[11px] text-muted-foreground">
            {prefix}
          </span>
          <input
            type="number"
            min="0"
            value={rounded}
            onChange={(event) => update(event.target.value)}
            className="h-8 w-full min-w-0 rounded-md bg-input pl-5 pr-2 text-right text-xs tabular text-foreground sharp-edge focus:outline-none focus:ring-1 focus:ring-ring min-[430px]:w-32"
          />
        </span>
      </span>
      <input
        type="range"
        min="0"
        max={Math.max(max, rounded)}
        step="25"
        value={rounded}
        onChange={(event) => update(event.target.value)}
        className="h-2 w-full accent-[color:var(--primary)]"
      />
    </label>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2/30 p-3 sharp-edge">
      <div className="text-[10px] uppercase leading-snug tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 break-words font-display text-base font-semibold leading-tight tabular sm:text-lg",
          valueClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

type ChartRange = "7D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "All";

const CHART_RANGES: ChartRange[] = ["7D", "1M", "3M", "6M", "YTD", "1Y", "All"];
const RANGE_POINTS: Record<ChartRange, number> = {
  "7D": 7,
  "1M": 4,
  "3M": 6,
  "6M": 8,
  YTD: 10,
  "1Y": 12,
  All: 12,
};

function loadKpiOrder(): KpiId[] {
  if (typeof window === "undefined") return [...DEFAULT_KPI_ORDER];
  try {
    const parsed = JSON.parse(localStorage.getItem(KPI_ORDER_KEY) || "[]");
    if (!Array.isArray(parsed)) return [...DEFAULT_KPI_ORDER];
    const saved = parsed.reduce<KpiId[]>((order, id) => {
      if (DEFAULT_KPI_ORDER.includes(id) && !order.includes(id)) order.push(id);
      return order;
    }, []);
    const missing = DEFAULT_KPI_ORDER.filter((id) => !saved.includes(id));
    return [...saved, ...missing];
  } catch {
    return [...DEFAULT_KPI_ORDER];
  }
}

function buildLiveSeries(income: number, expenses: number, range: ChartRange) {
  const monthLabels = [
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
  ];
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const points = RANGE_POINTS[range];
  const labels = range === "7D" ? dayLabels : monthLabels.slice(-points);

  return Array.from({ length: points }, (_, i) => {
    const wave = Math.sin((i / Math.max(points - 1, 1)) * Math.PI * 2);
    const jitter = Math.cos(i * 1.3) * 0.04;
    const inc = income * (1 + wave * 0.08 + jitter);
    const exp = expenses * (1 + Math.sin(((i + 2) / Math.max(points, 1)) * Math.PI * 2) * 0.05);
    return {
      month: labels[i] || `P${i + 1}`,
      income: inc,
      expenses: exp,
      net: inc - exp,
    };
  });
}

function scaleExpenseItems(items: ExpenseItems, targetTotal: number): ExpenseItems {
  const keys = EXPENSE_FIELDS.map((field) => field.key);
  const currentTotal = keys.reduce((sum, key) => sum + (Number(items[key]) || 0), 0);
  const target = Math.max(0, Math.round(targetTotal));
  const next = {} as ExpenseItems;

  if (currentTotal <= 0) {
    const even = target / keys.length;
    let assigned = 0;
    keys.forEach((key, index) => {
      const value = index === keys.length - 1 ? target - assigned : Math.round(even);
      next[key] = Math.max(0, value);
      assigned += next[key];
    });
    return next;
  }

  let assigned = 0;
  keys.forEach((key, index) => {
    const value =
      index === keys.length - 1
        ? target - assigned
        : Math.round(((Number(items[key]) || 0) / currentTotal) * target);
    next[key] = Math.max(0, value);
    assigned += next[key];
  });
  return next;
}

function buildTimeAllocation(state: EquationState) {
  const weeklyWork =
    state.timeUnit === "day"
      ? state.hoursPerUnit * 5
      : state.timeUnit === "week"
        ? state.hoursPerUnit
        : state.hoursPerUnit / 4.33;
  const work = Math.min(168, Math.max(0, weeklyWork));
  const sleep = Math.min(56, Math.max(0, 168 - work));
  const personal = Math.min(56, Math.max(0, 168 - work - sleep));
  const other = Math.max(0, 168 - work - sleep - personal);

  return [
    { name: "Work", value: work, color: "var(--chart-1)" },
    { name: "Personal", value: personal, color: "var(--chart-3)" },
    { name: "Sleep", value: sleep, color: "var(--chart-5)" },
    { name: "Other", value: other, color: "var(--chart-4)" },
  ];
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
