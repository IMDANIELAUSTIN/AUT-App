import { useMemo, useState } from "react";
import { Plus, Printer, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/openui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { Input } from "@/components/openui/Input";
import { FIAT_SYMBOL, fmtFiat, useEquation } from "@/lib/equation";

type InvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

function uid() {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function isShareAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function Invoices() {
  const { state, computed, activeProfile } = useEquation();
  const symbol = FIAT_SYMBOL[state.fiat];
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-${new Date().getFullYear()}-001`);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("Thank you for your business.");
  const [taxRate, setTaxRate] = useState(0);
  const [estimateHours, setEstimateHours] = useState(10);
  const [estimateRate, setEstimateRate] = useState(
    Math.max(1, Math.round(computed.netHourlyWage || computed.hourlyWage || 75)),
  );
  const [estimateMaterials, setEstimateMaterials] = useState(0);
  const [estimateMultiplier, setEstimateMultiplier] = useState(1);
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: uid(), description: "Professional Services", quantity: 1, rate: 500 },
  ]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.rate, 0),
    [lines],
  );
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  const estimateTotal = estimateHours * estimateRate * estimateMultiplier + estimateMaterials;

  const updateLine = <K extends keyof InvoiceLine>(id: string, key: K, value: InvoiceLine[K]) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [key]: value } : line)),
    );
  };

  const addLine = (line?: Partial<InvoiceLine>) => {
    setLines((current) => [
      ...current,
      {
        id: uid(),
        description: line?.description || "Service Item",
        quantity: line?.quantity ?? 1,
        rate: line?.rate ?? 0,
      },
    ]);
  };

  const addEstimateToInvoice = () => {
    addLine({
      description: `Estimate: ${estimateHours} Hours @ ${fmtFiat(estimateRate, state.fiat)} / Hr`,
      quantity: 1,
      rate: estimateTotal,
    });
  };

  const invoiceText = () =>
    [
      `${activeProfile.name || "Business"} Invoice ${invoiceNumber}`,
      `Client: ${clientName || "Client"}`,
      clientEmail ? `Email: ${clientEmail}` : "",
      `Due: ${dueDate}`,
      "",
      ...lines.map(
        (line) =>
          `${line.description} - ${line.quantity} x ${fmtFiat(line.rate, state.fiat)} = ${fmtFiat(line.quantity * line.rate, state.fiat)}`,
      ),
      "",
      `Subtotal: ${fmtFiat(subtotal, state.fiat)}`,
      `Tax: ${fmtFiat(tax, state.fiat)}`,
      `Total: ${fmtFiat(total, state.fiat)}`,
      notes ? `Notes: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  const shareInvoice = async () => {
    const text = invoiceText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${invoiceNumber} - ${activeProfile.name || "Invoice"}`,
          text,
        });
        toast.success("Invoice shared");
        return;
      } catch (error) {
        if (isShareAbort(error)) {
          toast.message("Share cancelled");
          return;
        }
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Invoice copied");
        return;
      } catch {
        // Fall through to the browser-level unavailable message.
      }
    }
    toast.error("Sharing is unavailable in this browser.");
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Invoices
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Create estimates, prepare professional invoices, print from device, or share natively.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print Invoice
          </Button>
          <Button type="button" size="sm" onClick={() => void shareInvoice()}>
            <Share2 className="h-3.5 w-3.5" /> Share Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estimate Calculator</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <NumberField label="Hours" value={estimateHours} onChange={setEstimateHours} />
              <NumberField
                label={`Rate (${symbol}/Hr)`}
                value={estimateRate}
                onChange={setEstimateRate}
              />
              <NumberField
                label="Effort Multiplier"
                value={estimateMultiplier}
                step={0.1}
                onChange={setEstimateMultiplier}
              />
              <NumberField
                label={`Materials (${symbol})`}
                value={estimateMaterials}
                onChange={setEstimateMaterials}
              />
              <div className="rounded-lg bg-primary/10 p-3 sharp-edge">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Estimated Total
                </div>
                <div className="mt-1 font-display text-3xl font-semibold tabular text-foreground">
                  {fmtFiat(estimateTotal, state.fiat)}
                </div>
              </div>
              <Button type="button" className="w-full" onClick={addEstimateToInvoice}>
                <Plus className="h-3.5 w-3.5" /> Add Estimate To Invoice
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <TextField
                label="Client Name"
                value={clientName}
                onChange={setClientName}
                placeholder="Client or Company"
              />
              <TextField
                label="Client Email"
                value={clientEmail}
                onChange={setClientEmail}
                placeholder="client@example.com"
              />
              <TextField label="Invoice Number" value={invoiceNumber} onChange={setInvoiceNumber} />
              <TextField label="Due Date" type="date" value={dueDate} onChange={setDueDate} />
              <NumberField label="Tax Rate (%)" value={taxRate} step={0.1} onChange={setTaxRate} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Professional Invoice</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeProfile.name || "Business Dashboard"} · {invoiceNumber}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => addLine()}>
              <Plus className="h-3.5 w-3.5" /> Line Item
            </Button>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-3 rounded-lg bg-surface-2/35 p-4 sharp-edge md:grid-cols-2">
              <div>
                <div className="font-display text-lg font-semibold text-foreground">
                  {activeProfile.name || "Business"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {activeProfile.location || "Business Location"}
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="text-xs text-muted-foreground">Bill To</div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {clientName || "Client Name"}
                </div>
                <div className="text-xs text-muted-foreground">{clientEmail || "Client Email"}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Description</th>
                    <th className="w-24 text-right">Qty</th>
                    <th className="w-32 text-right">Rate</th>
                    <th className="w-32 text-right">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="sharp-divider-t">
                      <td className="py-2 pr-3">
                        <Input
                          value={line.description}
                          onChange={(event) =>
                            updateLine(line.id, "description", event.target.value)
                          }
                        />
                      </td>
                      <td className="py-2 pl-3">
                        <Input
                          type="number"
                          min="0"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.id, "quantity", money(event.target.value))
                          }
                          className="text-right"
                        />
                      </td>
                      <td className="py-2 pl-3">
                        <Input
                          type="number"
                          min="0"
                          value={line.rate}
                          onChange={(event) =>
                            updateLine(line.id, "rate", money(event.target.value))
                          }
                          className="text-right"
                        />
                      </td>
                      <td className="py-2 pl-3 text-right font-semibold tabular text-foreground">
                        {fmtFiat(line.quantity * line.rate, state.fiat)}
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove Line Item"
                          disabled={lines.length <= 1}
                          onClick={() =>
                            setLines((current) => current.filter((item) => item.id !== line.id))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                <span>Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  className="min-h-28 w-full resize-y rounded-md bg-input px-3 py-2 text-sm text-foreground sharp-edge placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <div className="space-y-2 rounded-lg bg-surface-2/35 p-4 text-sm sharp-edge">
                <InvoiceTotal label="Subtotal" value={fmtFiat(subtotal, state.fiat)} />
                <InvoiceTotal
                  label={`Tax (${taxRate.toFixed(1)}%)`}
                  value={fmtFiat(tax, state.fiat)}
                />
                <div className="sharp-divider-t pt-2">
                  <InvoiceTotal label="Total Due" value={fmtFiat(total, state.fiat)} strong />
                </div>
                <div className="pt-2 text-[11px] text-muted-foreground">Due {dueDate}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <Input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(money(event.target.value))}
        className="text-right"
      />
    </label>
  );
}

function InvoiceTotal({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          strong
            ? "font-display text-xl font-semibold text-foreground"
            : "font-semibold tabular text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
