import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CheckCircle2, FileImage, FileText, Loader2, Upload, X } from "lucide-react";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/openui/Button";
import { useEquation, fmtFiat, type ExpenseKey, type FiatCode } from "@/lib/equation";
import {
  analyzeReceiptFile,
  loadImportedTransactions,
  parseCryptoTransactionsFile,
  receiptToImportedTransaction,
  upsertImportedTransactions,
  type ReceiptCandidate,
} from "@/lib/imports";
import { cn } from "@/lib/utils";

export function ImportDataDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, activeProfileId, setExpense } = useEquation();
  const [busy, setBusy] = useState(false);
  const [cryptoCount, setCryptoCount] = useState(0);
  const [receipts, setReceipts] = useState<ReceiptCandidate[]>([]);
  const [addedReceipts, setAddedReceipts] = useState<Record<string, boolean>>({});

  const importCrypto = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const parsed = (
        await Promise.all(
          files.map((file) =>
            parseCryptoTransactionsFile(file, { profileId: activeProfileId, fiat: state.fiat }),
          ),
        )
      ).flat();
      upsertImportedTransactions(parsed);
      setCryptoCount((count) => count + parsed.length);
      toast.success("Crypto transactions imported", {
        description: `${parsed.length} transaction${parsed.length === 1 ? "" : "s"} added to Bank Transactions.`,
      });
    } catch (error) {
      console.error(error);
      toast.error("Crypto import failed", { description: readableError(error) });
    } finally {
      setBusy(false);
    }
  };

  const importReceipts = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const transactions = loadImportedTransactions(activeProfileId);
      const analyzed = await Promise.all(
        files.map((file) =>
          analyzeReceiptFile(file, { profileId: activeProfileId, fiat: state.fiat, transactions }),
        ),
      );
      setReceipts((current) => [...analyzed, ...current]);
      toast.success("Receipt scan complete", {
        description: `${analyzed.length} file${analyzed.length === 1 ? "" : "s"} reviewed for amount, date, and duplicates.`,
      });
    } catch (error) {
      console.error(error);
      toast.error("Receipt import failed", { description: readableError(error) });
    } finally {
      setBusy(false);
    }
  };

  const addReceiptToExpenses = (receipt: ReceiptCandidate) => {
    if (!receipt.amount || receipt.matchedTransactionId) return;
    const key = receipt.expenseKey;
    setExpense(key, (Number(state.expenseItems[key]) || 0) + receipt.amount);
    upsertImportedTransactions([
      receiptToImportedTransaction(receipt, { profileId: activeProfileId }),
    ]);
    setAddedReceipts((current) => ({ ...current, [receipt.id]: true }));
    toast.success("Receipt added to expenses", {
      description: `${receipt.merchantName} was added to ${expenseLabel(key)}.`,
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface sharp-edge-card">
          <div className="flex items-start justify-between gap-4 sharp-divider-b px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-foreground">
                Import transactions
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Upload crypto exports, receipts, or invoices. Receipts are checked against imported
                transactions before they are added to expenses.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close import">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <ImportDropCard
                icon={<Upload className="h-4 w-4" />}
                title="Crypto transactions"
                description="Import CSV or JSON exports from Coinbase, wallets, or tax tools. Rows are added to Bank Transactions."
                accept=".csv,.json,text/csv,application/json,text/plain"
                disabled={busy}
                onChange={importCrypto}
              />
              <ImportDropCard
                icon={<FileImage className="h-4 w-4" />}
                title="Receipts and invoices"
                description="Upload PDFs or images. The app detects receipt details and checks for likely duplicate transactions."
                accept="application/pdf,image/*"
                disabled={busy}
                onChange={importReceipts}
              />
            </div>

            <div className="mt-4 grid gap-3">
              {busy && (
                <div className="flex items-center gap-2 rounded-lg bg-surface-2/50 p-3 text-sm text-muted-foreground sharp-edge">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing import files...
                </div>
              )}

              {cryptoCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary sharp-edge">
                  <CheckCircle2 className="h-4 w-4" />
                  {cryptoCount} crypto transaction{cryptoCount === 1 ? "" : "s"} imported for this
                  dashboard.
                </div>
              )}

              {receipts.length > 0 && (
                <div className="rounded-xl bg-surface sharp-edge-card">
                  <div className="flex items-center justify-between gap-3 sharp-divider-b px-4 py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Receipt review
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {receipts.length} file{receipts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="divide-y divide-[color:var(--border)]">
                    {receipts.map((receipt) => {
                      const duplicate = Boolean(receipt.matchedTransactionId);
                      const added = Boolean(addedReceipts[receipt.id]);
                      return (
                        <li
                          key={receipt.id}
                          className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-semibold text-foreground">
                                {receipt.merchantName || receipt.fileName}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-medium sharp-edge",
                                  duplicate
                                    ? "bg-amber-500/15 text-amber-500"
                                    : "bg-primary/10 text-primary",
                                )}
                              >
                                {duplicate
                                  ? "possible duplicate"
                                  : `${Math.round(receipt.confidence * 100)}% receipt`}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              {new Date(receipt.date).toLocaleDateString()} ·{" "}
                              {fmtReceiptAmount(receipt.amount, receipt.currency, state.fiat)} ·{" "}
                              {expenseLabel(receipt.expenseKey)}
                            </div>
                            <div className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                              {duplicate && (
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                              )}
                              <span>
                                {duplicate
                                  ? `Matched ${receipt.matchedTransactionName || "an imported transaction"} at ${Math.round((receipt.matchConfidence || 0) * 100)}% confidence.`
                                  : receipt.reason}
                              </span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={duplicate || added ? "outline" : "default"}
                            disabled={duplicate || added || receipt.amount <= 0}
                            onClick={() => addReceiptToExpenses(receipt)}
                          >
                            {duplicate ? "Matched" : added ? "Added" : "Add expense"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sharp-divider-t px-5 py-4">
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              Image receipts use OCR. Text-based PDFs usually provide the strongest duplicate
              matches.
            </span>
            <Dialog.Close asChild>
              <Button size="sm">Done</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ImportDropCard({
  icon,
  title,
  description,
  accept,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  accept: string;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer flex-col gap-3 rounded-xl bg-surface-2/45 p-4 sharp-edge transition-colors hover:bg-muted",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary sharp-edge">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <span className="mt-auto inline-flex h-8 items-center justify-center gap-2 rounded-md bg-background px-3 text-xs font-medium text-foreground sharp-edge group-hover:bg-surface">
        <FileText className="h-3.5 w-3.5" />
        Choose files
      </span>
      <input
        className="sr-only"
        type="file"
        accept={accept}
        multiple
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

function fmtReceiptAmount(amount: number, currency: string, fallback: FiatCode) {
  const code = ["USD", "EUR", "GBP", "JPY", "CAD"].includes(currency)
    ? (currency as FiatCode)
    : fallback;
  return fmtFiat(amount, code);
}

function expenseLabel(key: ExpenseKey) {
  const labels: Record<ExpenseKey, string> = {
    rent: "Rent",
    groceries: "Groceries",
    utilities: "Utilities",
    transportation: "Transportation",
    healthInsurance: "Health Insurance",
    contingency: "Contingency",
    savings: "Savings",
    recreational: "Recreational",
  };
  return labels[key];
}

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unable to process the selected files.";
}
