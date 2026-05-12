import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { useEquation, fmtFiat } from "@/lib/equation";
import { BankTransactionsWidget } from "@/components/BankTransactionsWidget";

export default function Transactions() {
  const { state, computed } = useEquation();
  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader><CardTitle>Projected month over month</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr><th className="py-2 text-left">Month</th><th className="text-right">Income</th><th className="text-right">Expenses</th><th className="text-right">Net</th></tr>
            </thead>
            <tbody>
              {computed.series.map((s) => (
                <tr key={s.month} className="sharp-divider-t">
                  <td className="py-2">{s.month} 2026</td>
                  <td className="text-right tabular">{fmtFiat(s.income, state.fiat)}</td>
                  <td className="text-right tabular">{fmtFiat(s.expenses, state.fiat)}</td>
                  <td className={`text-right tabular ${s.net >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--destructive)]"}`}>{fmtFiat(s.net, state.fiat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
      <BankTransactionsWidget limit={20} />
    </div>
  );
}
