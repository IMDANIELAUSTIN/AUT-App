import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { Button } from "@/components/openui/Button";
import { ConnectBankButton } from "./ConnectBankButton";
import { getSupabaseConfigError, isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useUserKey } from "@/lib/useUserKey";
import { useEquation, fmtFiat, type FiatCode } from "@/lib/equation";
import {
  IMPORTS_CHANGED_EVENT,
  loadImportedTransactions,
  upsertImportedTransactions,
  type ImportedTransaction,
} from "@/lib/imports";
import { AlertCircle, Building2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type PlaidTx = {
  id: string;
  date: string;
  name: string | null;
  merchant_name: string | null;
  amount: number;
  iso_currency_code: string | null;
  category: string[] | null;
  pending: boolean;
};
type PlaidItem = {
  institution_name: string | null;
  accounts: Array<{ name: string; mask?: string }>;
};
type DisplayTx = {
  id: string;
  date: string;
  name: string;
  amount: number;
  currency: string;
  category?: string;
  pending?: boolean;
  source: "bank" | "crypto" | "receipt";
  asset?: string;
};

export function BankTransactionsWidget({
  limit = 5,
  compact = false,
}: {
  limit?: number;
  compact?: boolean;
}) {
  const userKey = useUserKey();
  const { state, activeProfileId } = useEquation();
  const [txs, setTxs] = useState<PlaidTx[]>([]);
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [importedTxs, setImportedTxs] = useState<ImportedTransaction[]>(() =>
    loadImportedTransactions(activeProfileId),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const lastAutoLoadKey = useRef("");

  const load = useCallback(
    async (sync = false) => {
      if (!userKey) return;
      if (!isSupabaseConfigured) {
        if (sync) toast.error("Bank sync is not configured", { description: getSupabaseConfigError() });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke("plaid-transactions", {
          body: { user_key: userKey, sync },
        });
        if (error) throw error;
        const transactions = data?.transactions ?? [];
        setTxs(transactions);
        setItems(data?.items ?? []);
        upsertPlaidTransactions(transactions, activeProfileId);
        if (sync) {
          setLastSyncedAt(new Date().toISOString());
          toast.success("Transactions synced");
        }
      } catch (e) {
        const message = readableError(e);
        setError(message);
        if (sync) toast.error("Sync failed", { description: message });
      } finally {
        setLoading(false);
      }
    },
    [activeProfileId, userKey],
  );

  useEffect(() => {
    if (!userKey || !isSupabaseConfigured) return;
    const autoLoadKey = `${activeProfileId}:${userKey}`;
    if (lastAutoLoadKey.current === autoLoadKey) return;
    lastAutoLoadKey.current = autoLoadKey;
    void load(false);
  }, [activeProfileId, load, userKey]);

  useEffect(() => {
    const refresh = () => setImportedTxs(loadImportedTransactions(activeProfileId));
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "fyi:imported-transactions:v1") refresh();
    };
    window.addEventListener(IMPORTS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(IMPORTS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [activeProfileId]);

  const localRows = importedTxs
    .filter((tx) => tx.source !== "bank" && !tx.duplicateOf)
    .map(importedToRow);
  const bankRows = txs.map(plaidToRow);
  const rows = [...bankRows, ...localRows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
  const bankConnected = items.length > 0;
  const connected = bankConnected || localRows.length > 0;
  const cryptoCount = localRows.filter((row) => row.source === "crypto").length;
  const receiptCount = localRows.filter((row) => row.source === "receipt").length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Bank transactions</CardTitle>
        {bankConnected && (
          <Button size="sm" variant="ghost" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{" "}
            {loading ? "Syncing" : "Sync"}
          </Button>
        )}
      </CardHeader>
      <CardBody>
        {loading && !connected && !error ? (
          <div className="grid place-items-center gap-2 rounded-lg bg-surface-2/30 p-6 text-center sharp-edge">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Checking bank connection</p>
            <p className="text-xs text-muted-foreground">
              Loading linked accounts and recent transactions.
            </p>
          </div>
        ) : error && !connected ? (
          <div className="grid gap-3 rounded-lg bg-[color:var(--destructive)]/10 p-4 sharp-edge">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--destructive)]" />
              <div>
                <p className="text-sm font-medium text-foreground">Transaction sync failed</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{error}</p>
              </div>
            </div>
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => load(false)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Retry
              </Button>
            </div>
          </div>
        ) : !connected ? (
          <div className="grid place-items-center gap-2 rounded-lg bg-surface-2/30 p-6 text-center sharp-edge">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">No bank connected</p>
            <p className="text-xs text-muted-foreground">
              Securely link an account via Plaid to see real transactions here.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-3 flex gap-2 rounded-lg bg-[color:var(--destructive)]/10 p-3 text-xs text-muted-foreground sharp-edge">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--destructive)]" />
                <span>
                  Bank sync failed, but imported transactions are still available. {error}
                </span>
              </div>
            )}
            <ul className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
              {items.map((it, i) => (
                <li
                  key={i}
                  className="rounded-md bg-surface-2/40 px-2 py-1 sharp-edge text-muted-foreground"
                >
                  {it.institution_name || "Bank"} · {it.accounts?.length ?? 0} acct
                </li>
              ))}
              {cryptoCount > 0 && (
                <li className="rounded-md bg-surface-2/40 px-2 py-1 sharp-edge text-muted-foreground">
                  Crypto imports · {cryptoCount}
                </li>
              )}
              {receiptCount > 0 && (
                <li className="rounded-md bg-surface-2/40 px-2 py-1 sharp-edge text-muted-foreground">
                  Receipt imports · {receiptCount}
                </li>
              )}
              {lastSyncedAt && (
                <li className="rounded-md bg-surface-2/40 px-2 py-1 sharp-edge text-muted-foreground">
                  Synced{" "}
                  {new Date(lastSyncedAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </li>
              )}
            </ul>
            {rows.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-lg bg-surface-2/30 p-5 text-center sharp-edge">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <RefreshCw className="h-5 w-5 text-muted-foreground" />
                )}
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? "Syncing recent transactions..."
                    : "No transactions yet. Try Sync or Import to pull activity."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--border)]">
                {rows.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.name || "Transaction"}</div>
                      {!compact && (
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(t.date).toLocaleDateString()}{" "}
                          {t.category ? `· ${t.category}` : ""} {t.asset ? `· ${t.asset}` : ""}{" "}
                          {t.source !== "bank" ? `· ${sourceLabel(t.source)}` : ""}{" "}
                          {t.pending ? "· pending" : ""}
                        </div>
                      )}
                    </div>
                    <div
                      className={`tabular text-right ${t.amount < 0 ? "text-[color:var(--success)]" : "text-foreground"}`}
                    >
                      {formatAmount(-t.amount, t.currency, state.fiat)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="mt-4 flex justify-end border-t border-[color:var(--border)] pt-3">
          <ConnectBankButton
            size="sm"
            variant={bankConnected ? "outline" : "default"}
            label={bankConnected ? "Add another bank" : "Connect bank"}
            onConnected={() => load(false)}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function plaidToRow(t: PlaidTx): DisplayTx {
  return {
    id: `bank-${t.id}`,
    date: t.date,
    name: t.merchant_name || t.name || "Transaction",
    amount: Number(t.amount) || 0,
    currency: t.iso_currency_code || "USD",
    category: t.category?.[0],
    pending: t.pending,
    source: "bank",
  };
}

function importedToRow(t: ImportedTransaction): DisplayTx {
  return {
    id: `${t.source}-${t.id}`,
    date: t.date,
    name: t.merchantName || t.name || "Transaction",
    amount: Number(t.amount) || 0,
    currency: t.currency || "USD",
    category: t.category,
    pending: t.pending,
    source: t.source,
    asset: t.asset,
  };
}

function upsertPlaidTransactions(transactions: PlaidTx[], profileId: string) {
  if (!transactions.length) return;
  upsertImportedTransactions(
    transactions.map((t) => ({
      id: `bank-${t.id}`,
      source: "bank",
      profileId,
      date: t.date,
      name: t.name || t.merchant_name || "Transaction",
      merchantName: t.merchant_name || undefined,
      amount: Number(t.amount) || 0,
      currency: t.iso_currency_code || "USD",
      category: t.category?.[0],
      pending: t.pending,
      externalId: t.id,
      importedAt: new Date().toISOString(),
    })),
  );
}

function sourceLabel(source: DisplayTx["source"]) {
  if (source === "crypto") return "crypto";
  if (source === "receipt") return "receipt";
  return "bank";
}

function formatAmount(amount: number, currency: string, fallback: FiatCode) {
  const code = ["USD", "EUR", "GBP", "JPY", "CAD"].includes(currency)
    ? (currency as FiatCode)
    : fallback;
  return fmtFiat(amount, code);
}

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unable to sync transactions. Check the bank connection and Supabase/Plaid configuration.";
  }
}
