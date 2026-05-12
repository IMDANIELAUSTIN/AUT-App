import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import {
  IMPORTS_CHANGED_EVENT,
  loadImportedTransactions,
  type ImportedTransaction,
} from "@/lib/imports";
import { useUserKey } from "@/lib/useUserKey";

type PlaidTx = {
  id: string;
  amount: number;
  plaid_transaction_id: string;
  date: string;
};

export type NetWorthEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // raw amount (positive = expense, negative = income)
  bucket: "importedExpense" | "importedIncome" | "bank";
};

/**
 * Live net worth contribution from imported expenses/transactions + linked bank
 * (Plaid) transactions.
 *
 * Convention used elsewhere in the app:
 *  - positive `amount` = money out (expense)
 *  - negative `amount` = money in (income)
 *
 * Net worth contribution = -sum(amount).
 */
export function useNetWorth(profileId?: string) {
  const userKey = useUserKey();
  const [imported, setImported] = useState<ImportedTransaction[]>(() =>
    typeof window === "undefined" ? [] : loadImportedTransactions(profileId),
  );
  const [bank, setBank] = useState<PlaidTx[]>([]);

  useEffect(() => {
    const refresh = () => setImported(loadImportedTransactions(profileId));
    refresh();
    window.addEventListener(IMPORTS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(IMPORTS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [profileId]);

  useEffect(() => {
    if (!userKey || !isSupabaseConfigured) return;
    let cancelled = false;

    const fetchAll = async () => {
      const { data, error } = await supabase
        .from("plaid_transactions")
        .select("id, amount, plaid_transaction_id, date")
        .eq("user_key", userKey);
      if (error) {
        console.warn("[useNetWorth] plaid fetch failed", error.message);
        return;
      }
      if (!cancelled) {
        setBank((data ?? []).map((row) => ({
          id: String(row.id),
          plaid_transaction_id: String(row.plaid_transaction_id),
          amount: Number(row.amount) || 0,
          date: String(row.date),
        })));
      }
    };

    fetchAll();

    const topicId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(`plaid_tx:${userKey}:${topicId}`);

    try {
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "plaid_transactions",
            filter: `user_key=eq.${userKey}`,
          },
          () => {
            if (!cancelled) void fetchAll();
          },
        )
        .subscribe((status, error) => {
          if (error) console.warn("[useNetWorth] realtime subscribe failed", error.message);
          if (status === "CHANNEL_ERROR") console.warn("[useNetWorth] realtime channel error");
        });
    } catch (error) {
      console.warn("[useNetWorth] realtime setup failed", error);
    }

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userKey]);

  return useMemo(() => {
    // Skip imported entries that mirror bank rows (deduped via duplicateOf or source=bank)
    const importedClean = imported.filter((tx) => tx.source !== "bank" && !tx.duplicateOf);

    const importedExpenses = importedClean.filter((tx) => (Number(tx.amount) || 0) > 0);
    const importedIncome = importedClean.filter((tx) => (Number(tx.amount) || 0) < 0);

    const importedExpenseTotal = importedExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const importedIncomeTotal = importedIncome.reduce((s, t) => s + (Number(t.amount) || 0), 0); // negative
    const bankTotal = bank.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const netWorth = -(importedExpenseTotal + importedIncomeTotal + bankTotal);

    const entries: NetWorthEntry[] = [
      ...importedExpenses.map<NetWorthEntry>((t) => ({
        id: `imp-exp-${t.id}`,
        date: t.date,
        amount: Number(t.amount) || 0,
        bucket: "importedExpense",
      })),
      ...importedIncome.map<NetWorthEntry>((t) => ({
        id: `imp-inc-${t.id}`,
        date: t.date,
        amount: Number(t.amount) || 0,
        bucket: "importedIncome",
      })),
      ...bank.map<NetWorthEntry>((t) => ({
        id: `bank-${t.id}`,
        date: t.date,
        amount: Number(t.amount) || 0,
        bucket: "bank",
      })),
    ];

    const count = entries.length;
    return {
      netWorth,
      count,
      importedCount: importedClean.length,
      bankCount: bank.length,
      breakdown: {
        importedExpenses: { total: importedExpenseTotal, count: importedExpenses.length },
        importedIncome: { total: -importedIncomeTotal, count: importedIncome.length }, // positive magnitude
        bank: { total: bankTotal, count: bank.length },
      },
      entries,
    };
  }, [imported, bank]);
}
