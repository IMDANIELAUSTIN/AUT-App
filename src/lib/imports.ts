import type { ExpenseKey, FiatCode } from "@/lib/equation";

export const IMPORTED_TRANSACTIONS_KEY = "fyi:imported-transactions:v1";
export const IMPORTS_CHANGED_EVENT = "fyi:imports-changed";

export type ImportSource = "bank" | "crypto" | "receipt";

export type ImportedTransaction = {
  id: string;
  source: ImportSource;
  profileId?: string;
  date: string;
  name: string;
  merchantName?: string;
  amount: number;
  currency: string;
  category?: string;
  pending?: boolean;
  externalId?: string;
  fileName?: string;
  asset?: string;
  cryptoAmount?: number;
  duplicateOf?: string;
  duplicateConfidence?: number;
  importedAt: string;
  raw?: Record<string, unknown>;
};

export type ReceiptCandidate = {
  id: string;
  fileName: string;
  fileType: string;
  merchantName: string;
  date: string;
  amount: number;
  currency: string;
  confidence: number;
  expenseKey: ExpenseKey;
  matchedTransactionId?: string;
  matchedTransactionName?: string;
  matchConfidence?: number;
  reason: string;
};

type CsvRow = Record<string, string>;

const CRYPTO_ASSETS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "USDC",
  "USDT",
  "DOGE",
  "ADA",
  "MATIC",
  "AVAX",
  "LTC",
  "XRP",
]);

export function loadImportedTransactions(profileId?: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(IMPORTED_TRANSACTIONS_KEY) || "[]");
    const list = Array.isArray(parsed)
      ? (parsed.map(sanitizeImportedTransaction).filter(Boolean) as ImportedTransaction[])
      : [];
    return profileId ? list.filter((tx) => !tx.profileId || tx.profileId === profileId) : list;
  } catch {
    return [];
  }
}

export function saveImportedTransactions(transactions: ImportedTransaction[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(IMPORTED_TRANSACTIONS_KEY, JSON.stringify(transactions));
  window.dispatchEvent(new CustomEvent(IMPORTS_CHANGED_EVENT));
}

export function upsertImportedTransactions(next: ImportedTransaction[]) {
  if (!next.length) return;
  const current = loadImportedTransactions();
  const byKey = new Map<string, ImportedTransaction>();
  for (const tx of current) byKey.set(importKey(tx), tx);
  for (const tx of next) byKey.set(importKey(tx), tx);
  saveImportedTransactions(Array.from(byKey.values()).sort(sortByDateDesc));
}

export async function parseCryptoTransactionsFile(
  file: File,
  opts: { profileId?: string; fiat: FiatCode },
) {
  const text = await file.text();
  const trimmed = text.trim();
  if (!trimmed) return [];

  const rows =
    trimmed.startsWith("[") || trimmed.startsWith("{") ? rowsFromJson(trimmed) : parseCsv(trimmed);

  const importedAt = new Date().toISOString();
  return rows
    .map((row, index) =>
      cryptoRowToTransaction(row, {
        fileName: file.name,
        profileId: opts.profileId,
        fallbackCurrency: opts.fiat,
        importedAt,
        index,
      }),
    )
    .filter(Boolean) as ImportedTransaction[];
}

export async function analyzeReceiptFile(
  file: File,
  opts: { profileId?: string; fiat: FiatCode; transactions?: ImportedTransaction[] },
) {
  const text = await extractFileText(file);
  const source = `${file.name}\n${text}`;
  const amount = extractAmount(source);
  const date = extractDate(source) || new Date().toISOString().slice(0, 10);
  const merchantName = extractMerchant(file.name, text);
  const currency = extractCurrency(source) || opts.fiat;
  const receiptLike =
    /receipt|invoice|order|purchase|merchant|subtotal|total|tax|paid/i.test(source) ||
    file.type.startsWith("image/") ||
    file.type === "application/pdf";
  const confidence = Math.min(
    0.98,
    (receiptLike ? 0.35 : 0.1) +
      (amount > 0 ? 0.35 : 0) +
      (date ? 0.15 : 0) +
      (merchantName ? 0.13 : 0),
  );
  const match =
    amount > 0
      ? findReceiptMatch(
          { amount, date, merchantName, currency },
          opts.transactions || loadImportedTransactions(opts.profileId),
        )
      : null;

  return {
    id: uid("receipt"),
    fileName: file.name,
    fileType: file.type || "unknown",
    merchantName: merchantName || "Receipt",
    date,
    amount,
    currency,
    confidence,
    expenseKey: guessExpenseKey(`${merchantName} ${source}`),
    matchedTransactionId: match?.transaction.id,
    matchedTransactionName: match?.transaction.merchantName || match?.transaction.name,
    matchConfidence: match?.confidence,
    reason:
      amount > 0
        ? match
          ? "Matched against an imported transaction, so it can be skipped to avoid a duplicate."
          : "No close imported transaction match was found."
        : "No amount was detected. Review the file before adding it to expenses.",
  } satisfies ReceiptCandidate;
}

export function receiptToImportedTransaction(
  receipt: ReceiptCandidate,
  opts: { profileId?: string; duplicateOf?: string },
) {
  return {
    id: receipt.id,
    source: "receipt",
    profileId: opts.profileId,
    date: receipt.date,
    name: receipt.merchantName || receipt.fileName,
    merchantName: receipt.merchantName,
    amount: receipt.amount,
    currency: receipt.currency,
    category: receipt.expenseKey,
    fileName: receipt.fileName,
    duplicateOf: opts.duplicateOf,
    duplicateConfidence: receipt.matchConfidence,
    importedAt: new Date().toISOString(),
  } satisfies ImportedTransaction;
}

export function findReceiptMatch(
  receipt: { amount: number; date: string; merchantName: string; currency: string },
  transactions: ImportedTransaction[],
) {
  let best: { transaction: ImportedTransaction; confidence: number } | null = null;
  for (const tx of transactions) {
    if (tx.duplicateOf) continue;
    if (tx.amount <= 0) continue;
    const amountScore = Math.max(
      0,
      1 - Math.abs(Math.abs(tx.amount) - receipt.amount) / Math.max(receipt.amount, 1),
    );
    if (amountScore < 0.92) continue;

    const dayGap = Math.abs(daysBetween(tx.date, receipt.date));
    if (dayGap > 5) continue;
    const dateScore = Math.max(0, 1 - dayGap / 5);
    const nameScore = merchantSimilarity(receipt.merchantName, tx.merchantName || tx.name);
    const confidence = amountScore * 0.55 + dateScore * 0.25 + nameScore * 0.2;
    if (!best || confidence > best.confidence) best = { transaction: tx, confidence };
  }
  return best && best.confidence >= 0.72 ? best : null;
}

export function guessExpenseKey(value: string): ExpenseKey {
  const text = value.toLowerCase();
  if (/rent|lease|apartment|mortgage/.test(text)) return "rent";
  if (
    /grocery|market|whole foods|trader|target|walmart|costco|restaurant|coffee|food|meal/.test(text)
  )
    return "groceries";
  if (
    /utility|utilities|electric|power|water|gas bill|internet|spectrum|comcast|verizon|at&t|phone|sewer|trash/.test(
      text,
    )
  )
    return "utilities";
  if (/uber|lyft|shell|chevron|gas|fuel|parking|metro|transit|airline|flight/.test(text))
    return "transportation";
  if (/clinic|doctor|dental|pharmacy|cvs|walgreens|health|insurance|medical/.test(text))
    return "healthInsurance";
  if (/save|savings|investment|brokerage/.test(text)) return "savings";
  return "recreational";
}

function cryptoRowToTransaction(
  row: CsvRow,
  opts: {
    fileName: string;
    profileId?: string;
    fallbackCurrency: FiatCode;
    importedAt: string;
    index: number;
  },
) {
  const normalized = normalizeRow(row);
  const date =
    normalizeDate(
      getFirst(normalized, [
        "date",
        "time",
        "timestamp",
        "createdat",
        "created",
        "transactiondate",
      ]),
    ) || new Date().toISOString().slice(0, 10);
  const asset = getFirst(normalized, [
    "asset",
    "currency",
    "coin",
    "symbol",
    "crypto",
    "token",
  ])?.toUpperCase();
  const type =
    getFirst(normalized, ["type", "side", "action", "transactiontype", "description"]) || "Crypto";
  const name =
    getFirst(normalized, ["name", "merchant", "description", "memo", "notes"]) ||
    `${asset || "Crypto"} ${type}`;
  const cryptoAmount = parseNumber(
    getFirst(normalized, ["cryptoamount", "assetamount", "quantity", "qty", "amountcrypto"]),
  );
  const fiatAmount = parseNumber(
    getFirst(normalized, [
      "fiatamount",
      "usdamount",
      "usdamt",
      "usdvalue",
      "fiatvalue",
      "value",
      "total",
      "subtotal",
      "netamount",
      "amountusd",
    ]),
  );
  const genericAmount = parseNumber(getFirst(normalized, ["amount"]));
  const amount = Math.abs(fiatAmount || (asset && CRYPTO_ASSETS.has(asset) ? 0 : genericAmount));
  if (!amount && !cryptoAmount) return null;

  const kind = /sell|receive|deposit|income|reward|staking|interest/i.test(type)
    ? "income"
    : /transfer|swap|convert/i.test(type)
      ? "transfer"
      : "expense";
  return {
    id: uid(`crypto-${opts.index}`),
    source: "crypto",
    profileId: opts.profileId,
    date,
    name,
    merchantName: asset ? `${asset} ${type}` : name,
    amount: kind === "income" ? -amount : amount,
    currency: extractCurrency(JSON.stringify(row)) || opts.fallbackCurrency,
    category: "Crypto",
    fileName: opts.fileName,
    asset,
    cryptoAmount,
    importedAt: opts.importedAt,
    raw: row,
  } satisfies ImportedTransaction;
}

async function extractFileText(file: File) {
  if (file.type.startsWith("text/")) return file.text();
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const head = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 200_000)));
    return head.replace(/[^\x20-\x7E\n\r\t]+/g, " ");
  }
  if (file.type.startsWith("image/")) {
    const { recognize } = await import("tesseract.js");
    const result = await recognize(file, "eng");
    return result.data.text || "";
  }
  return "";
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const [header = [], ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(header.map((key, index) => [key || `field_${index}`, values[index] || ""])),
  );
}

function rowsFromJson(text: string): CsvRow[] {
  try {
    const parsed = JSON.parse(text);
    const source = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.transactions)
        ? parsed.transactions
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];
    return source
      .filter((row: unknown) => row && typeof row === "object")
      .map((row: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)]),
        ),
      );
  } catch {
    return [];
  }
}

function normalizeRow(row: CsvRow) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFirst(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function sanitizeImportedTransaction(value: unknown): ImportedTransaction | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ImportedTransaction>;
  const amount = Number(raw.amount);
  if (!raw.id || !raw.date || !raw.name || !Number.isFinite(amount)) return null;
  return {
    id: String(raw.id),
    source:
      raw.source === "bank" || raw.source === "crypto" || raw.source === "receipt"
        ? raw.source
        : "receipt",
    profileId: typeof raw.profileId === "string" ? raw.profileId : undefined,
    date: String(raw.date),
    name: String(raw.name),
    merchantName: typeof raw.merchantName === "string" ? raw.merchantName : undefined,
    amount,
    currency: typeof raw.currency === "string" ? raw.currency : "USD",
    category: typeof raw.category === "string" ? raw.category : undefined,
    pending: Boolean(raw.pending),
    externalId: typeof raw.externalId === "string" ? raw.externalId : undefined,
    fileName: typeof raw.fileName === "string" ? raw.fileName : undefined,
    asset: typeof raw.asset === "string" ? raw.asset : undefined,
    cryptoAmount: Number.isFinite(Number(raw.cryptoAmount)) ? Number(raw.cryptoAmount) : undefined,
    duplicateOf: typeof raw.duplicateOf === "string" ? raw.duplicateOf : undefined,
    duplicateConfidence: Number.isFinite(Number(raw.duplicateConfidence))
      ? Number(raw.duplicateConfidence)
      : undefined,
    importedAt: typeof raw.importedAt === "string" ? raw.importedAt : new Date().toISOString(),
    raw: raw.raw && typeof raw.raw === "object" ? (raw.raw as Record<string, unknown>) : undefined,
  };
}

function importKey(tx: ImportedTransaction) {
  return [tx.profileId || "global", tx.source, tx.externalId || tx.id].join(":");
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortByDateDesc(a: ImportedTransaction, b: ImportedTransaction) {
  return b.date.localeCompare(a.date) || b.importedAt.localeCompare(a.importedAt);
}

function parseNumber(value?: string) {
  if (!value) return 0;
  const cleaned = value.replace(/[,$\s]/g, "");
  const accounting = /^\(.+\)$/.test(cleaned);
  const parsed = Number(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return accounting ? -parsed : parsed;
}

function extractAmount(text: string) {
  const matches = [
    ...text.matchAll(
      /(?:total|amount|paid|sale|charge|balance)?\s*[$€£]?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2})/gi,
    ),
  ]
    .map((match) => Math.abs(parseNumber(match[1])))
    .filter((value) => value > 0);
  if (!matches.length) return 0;
  return Math.max(...matches);
}

function extractCurrency(text: string) {
  if (/\bEUR\b|€/i.test(text)) return "EUR";
  if (/\bGBP\b|£/i.test(text)) return "GBP";
  if (/\bJPY\b|¥/i.test(text)) return "JPY";
  if (/\bCAD\b|C\$/i.test(text)) return "CAD";
  if (/\bUSD\b|\$/i.test(text)) return "USD";
  return "";
}

function extractDate(text: string) {
  const iso = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return normalizeDate(iso[0]);
  const us = text.match(/\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](20\d{2}|\d{2})\b/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return normalizeDate(`${year}-${us[1]}-${us[2]}`);
  }
  const named = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i,
  );
  if (named) return normalizeDate(`${named[1]} ${named[2]} ${named[3]}`);
  return "";
}

function normalizeDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function extractMerchant(fileName: string, text: string) {
  const named = text.match(/(?:merchant|vendor|store|from)[:\s]+([A-Za-z0-9 &'#.-]{3,48})/i)?.[1];
  if (named) return cleanupMerchant(named);
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/\b(receipt|invoice|order|scan|img|image|pdf)\b/gi, " ");
  return cleanupMerchant(
    base.replace(
      /\d{4}[-_.]\d{1,2}[-_.]\d{1,2}|\d{1,2}[-_.]\d{1,2}[-_.]\d{2,4}|[$€£]?\d+(?:\.\d{2})?/g,
      " ",
    ),
  );
}

function cleanupMerchant(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);
}

function merchantSimilarity(a: string, b: string) {
  const left = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
  const right = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
  if (!left.size || !right.size) return 0.25;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap += 1;
  return overlap / Math.max(left.size, right.size);
}

function daysBetween(a: string, b: string) {
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 999;
  return Math.round((left - right) / 86_400_000);
}
