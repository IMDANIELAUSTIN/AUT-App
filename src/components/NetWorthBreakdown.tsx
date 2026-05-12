import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { useEquation, fmtFiat } from "@/lib/equation";
import { useNetWorthContext } from "@/lib/netWorthContext";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Building2 } from "lucide-react";

export function NetWorthBreakdown() {
  const { state } = useEquation();
  const { breakdown, netWorth, count } = useNetWorthContext();

  const rows = [
    {
      key: "income",
      label: "Imported income",
      total: breakdown.importedIncome.total, // positive magnitude
      count: breakdown.importedIncome.count,
      contribution: breakdown.importedIncome.total, // adds to net worth
      icon: ArrowUpRight,
      color: "text-[color:var(--success)]",
      tone: "bg-[color:var(--success)]/10",
    },
    {
      key: "expenses",
      label: "Imported expenses",
      total: breakdown.importedExpenses.total,
      count: breakdown.importedExpenses.count,
      contribution: -breakdown.importedExpenses.total,
      icon: ArrowDownRight,
      color: "text-[color:var(--destructive)]",
      tone: "bg-[color:var(--destructive)]/10",
    },
    {
      key: "bank",
      label: "Bank transactions",
      total: Math.abs(breakdown.bank.total),
      count: breakdown.bank.count,
      contribution: -breakdown.bank.total,
      icon: Building2,
      color:
        breakdown.bank.total >= 0
          ? "text-[color:var(--destructive)]"
          : "text-[color:var(--success)]",
      tone: "bg-surface-2/40",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Breakdown</CardTitle>
        <span
          className={cn(
            "font-display text-sm font-semibold tabular",
            netWorth >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]",
          )}
        >
          {fmtFiat(netWorth, state.fiat)}
        </span>
      </CardHeader>
      <CardBody>
        {count === 0 ? (
          <div className="grid place-items-center gap-1 rounded-lg bg-surface-2/30 p-5 text-center sharp-edge">
            <p className="text-sm font-medium">No data yet</p>
            <p className="text-xs text-muted-foreground">
              Import or sync transactions to see a breakdown.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <li
                  key={row.key}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg p-3 sharp-edge",
                    row.tone,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-md bg-background/40",
                        row.color,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {row.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.count} item{row.count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-sm font-semibold tabular text-foreground">
                      {fmtFiat(row.total, state.fiat)}
                    </div>
                    <div
                      className={cn(
                        "text-[11px] tabular",
                        row.contribution >= 0
                          ? "text-[color:var(--success)]"
                          : "text-[color:var(--destructive)]",
                      )}
                    >
                      {row.contribution >= 0 ? "+" : "−"}
                      {fmtFiat(Math.abs(row.contribution), state.fiat)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
